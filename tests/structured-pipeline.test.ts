import { afterAll, beforeAll, beforeEach, expect, it, vi } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import {
  claimStructured,
  finishStructured,
  stageStructured,
} from "../src/lib/structured/pipeline";
import { normalizeRecord } from "../src/lib/structured/normalize";
import type { db as applicationDb } from "../src/lib/db";
const { discover } = vi.hoisted(() => ({ discover: vi.fn() }));
vi.mock("../src/lib/structured/discover", async (original) => ({
  ...(await original<object>()),
  discover,
}));
let sql: PGlite;
beforeAll(async () => {
  sql = new PGlite();
  await sql.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await sql.exec(readFileSync(new URL(file, folder), "utf8"));
}, 30000);
afterAll(async () => sql.close());
beforeEach(async () => {
  await sql.exec(
    "delete from events; delete from advisories; delete from documents; delete from extraction_budget;",
  );
});

// Execute the application's conditional REST operations against a real PostgreSQL engine.
// This adapter deliberately supports only the builder operations exercised by the claim.
function query(table: string) {
  const values: unknown[] = [],
    where: string[] = [];
  let update: Record<string, unknown> | undefined,
    returning = false,
    limit = "",
    order = "";
  const bind = (v: unknown) => {
    values.push(v);
    return "$" + values.length;
  };
  const q = {
    update(v: Record<string, unknown>) {
      update = v;
      return q;
    },
    select(_columns: string) {
      returning = true;
      return q;
    },
    in(column: string, v: unknown[]) {
      where.push(`${column} in (${v.map(bind).join(",")})`);
      return q;
    },
    eq(column: string, v: unknown) {
      where.push(`${column}=${bind(v)}`);
      return q;
    },
    lt(column: string, v: unknown) {
      where.push(`${column}<${bind(v)}`);
      return q;
    },
    lte(column: string, v: unknown) {
      where.push(`${column}<=${bind(v)}`);
      return q;
    },
    gte(column: string, v: unknown) {
      where.push(`${column}>=${bind(v)}`);
      return q;
    },
    or(expression: string) {
      const prefix =
        "status.eq.pending,and(status.eq.processing,leased_until.lte.";
      if (!expression.startsWith(prefix))
        throw new Error("Unsupported test expression");
      where.push(
        `(status='pending' or (status='processing' and leased_until<=${bind(expression.slice(prefix.length, -1))}))`,
      );
      return q;
    },
    order(column: string) {
      order = " order by " + column;
      return q;
    },
    limit(n: number) {
      limit = " limit " + n;
      return q;
    },
    async then(
      resolve: (value: unknown) => unknown,
      reject: (error: unknown) => unknown,
    ) {
      try {
        const statement = update
          ? `update ${table} set ${Object.entries(update)
              .map(([column, value]) => `${column}=${bind(value)}`)
              .join(",")}`
          : `select * from ${table}`;
        const result = await sql.query(
          statement +
            (where.length ? " where " + where.join(" and ") : "") +
            order +
            limit +
            (update && returning ? " returning *" : ""),
          values,
        );
        return resolve({ data: result.rows, error: null });
      } catch (error) {
        return reject(error);
      }
    },
  };
  return q;
}
const client = {
  from: query,
  rpc: async (name: string, args: Record<string, unknown>) => {
    if (name !== "finish_document") throw new Error("Unexpected RPC");
    try {
      await sql.query("select finish_document($1,$2,$3,$4)", [
        args.document_id,
        args.token,
        JSON.stringify(args.result),
        args.model_name,
      ]);
      return { error: null };
    } catch (error) {
      return { error };
    }
  },
} as unknown as ReturnType<typeof applicationDb>;
async function enqueue() {
  const normalized = normalizeRecord("core-osv", {
    id: "OSV-TEST",
    modified: "2026-10-24T10:00:00Z",
    summary: "An advisory",
    affected: [],
  });
  const body = JSON.stringify({
    normalization_version: 1,
    source_id: "core-osv",
    ...normalized,
  });
  await sql.query("select enqueue_document('core-osv',$1,'test',$2,null)", [
    normalized.url,
    body,
  ]);
}
it("lets only one concurrent structured claimant publish, without consuming model budget", async () => {
  await enqueue();
  const claimed = (
    await Promise.all([claimStructured(client), claimStructured(client)])
  ).filter((job) => job !== null);
  expect(claimed).toHaveLength(1);
  await finishStructured(client, claimed[0]!);
  const events = (
    await sql.query<{ model: string; payload: { structured: { id: string } } }>(
      "select * from events",
    )
  ).rows;
  expect(events).toHaveLength(1);
  expect(events[0].model).toBe("structured:osv:1");
  expect(events[0].payload.structured.id).toBe("OSV-TEST");
  expect(
    (await sql.query("select * from extraction_budget")).rows,
  ).toHaveLength(0);
});
it("fences a stale structured worker after a replacement lease", async () => {
  await enqueue();
  const first = await claimStructured(client);
  expect(first).not.toBeNull();
  await sql.exec("update documents set leased_until=now()-interval '1 minute'");
  const second = await claimStructured(client);
  expect(second?.lease_token).not.toBe(first?.lease_token);
  await expect(finishStructured(client, first!)).rejects.toThrow(/Lease/);
  await finishStructured(client, second!);
  expect((await sql.query("select * from events")).rows).toHaveLength(1);
});
it("marks expired fifth attempts failed for health reporting", async () => {
  await enqueue();
  await sql.exec(
    "update documents set status='processing',attempts=5,leased_until=now()-interval '1 minute'",
  );
  expect(await claimStructured(client)).toBeNull();
  expect(
    (await sql.query<{ status: string }>("select status from documents"))
      .rows[0].status,
  ).toBe("failed");
});
it("never advances a source checkpoint after a partial staging failure", async () => {
  discover.mockResolvedValue({
    items: Array.from({ length: 501 }, (_, i) => ({
      link: `https://osv.dev/vulnerability/OSV-${i}`,
      structured: { id: `OSV-${i}`, modified: "2026-10-24T10:00:00Z" },
    })),
    state: { since: "2026-10-24T10:00:00Z" },
    more: false,
  });
  const rpc = vi
    .fn()
    .mockResolvedValueOnce({ error: null })
    .mockResolvedValueOnce({ error: new Error("staging failed") });
  const from = vi.fn();
  await expect(
    stageStructured(
      { rpc, from } as unknown as ReturnType<typeof applicationDb>,
      {
        id: "core-osv",
        lease_token: "token",
        verification: { sync: { since: "2026-10-23T00:00:00Z" } },
      },
      Date.now() + 10000,
    ),
  ).rejects.toThrow("staging failed");
  expect(rpc).toHaveBeenCalledTimes(2);
  expect(from).not.toHaveBeenCalled();
});
