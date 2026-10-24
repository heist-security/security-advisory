import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import sources from "../sources/registry.json";
let db: PGlite;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    await db.exec(readFileSync(new URL(file, folder), "utf8"));
}, 30000);
afterAll(async () => db.close());
describe.sequential("publisher activation and paid claims", () => {
  it("enables the exact registry and retains the three structured checkpoints", async () => {
    const rows = (
      await db.query<{ id: string }>(
        "select id from sources where enabled order by id",
      )
    ).rows;
    expect(rows.map((s) => s.id)).toEqual(
      [...sources.map((s) => s.id), "core-osv", "core-cve", "core-kev"].sort(),
    );
    const core = (
      await db.query<{ since: string }>(
        "select verification #>> '{sync,since}' as since from sources where id like 'core-%'",
      )
    ).rows;
    expect(core).toHaveLength(3);
    expect(core.every((s) => s.since === "2026-09-24T00:00:00Z")).toBe(true);
  });
  it("skips structured and unselected backlog and fences overlapping workers within one budget", async () => {
    for (const id of ["core-osv", "nodejs", "ruby"])
      await db.query(
        "select enqueue_document($1,$2,'hash','Test document',null)",
        [id, `https://example.org/${id}`],
      );
    const selected = ["ruby", "core-osv"];
    const first = (
      await db.query<{ source_id: string; lease_token: string }>(
        "select * from claim_vendor_document(1,$1)",
        [selected],
      )
    ).rows;
    expect(first).toHaveLength(1);
    expect(first[0].source_id).toBe("ruby");
    expect(
      (await db.query("select * from claim_vendor_document(1,$1)", [selected]))
        .rows,
    ).toHaveLength(0);
    expect(
      (await db.query("select * from claim_document(1)")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from extraction_budget",
        )
      ).rows[0].attempts,
    ).toBe(1);
    await db.query(
      "select fail_document(id,lease_token,'extraction_failed') from documents where source_id='ruby'",
    );
    await db.exec(
      "update documents set available_at=now() where source_id='ruby'",
    );
    const retried = (
      await db.query<{ attempts: number; lease_token: string }>(
        "select * from claim_vendor_document(2,$1)",
        [selected],
      )
    ).rows[0];
    expect(retried.attempts).toBe(2);
    expect(retried.lease_token).not.toBe(first[0].lease_token);
    expect(
      (
        await db.query<{ attempts: number }>(
          "select attempts from documents where source_id='core-osv'",
        )
      ).rows[0].attempts,
    ).toBe(0);
  });
  it("does not consume an attempt when selected work is absent or disabled", async () => {
    const before = (await db.query("select * from extraction_budget")).rows;
    await db.exec("update sources set enabled=false where id='nodejs'");
    expect(
      (
        await db.query(
          "select * from claim_vendor_document(60,array['nodejs'])",
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.query(
          "select * from claim_vendor_document(60,array[]::text[])",
        )
      ).rows,
    ).toHaveLength(0);
    expect((await db.query("select * from extraction_budget")).rows).toEqual(
      before,
    );
  });
  it("allows only the server role to use the paid claim RPC", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(
        db.query("select * from claim_vendor_document(60,array['ruby'])"),
      ).rejects.toThrow(/permission denied/);
      await db.exec("reset role");
    }
    await db.exec("set role service_role");
    await expect(
      db.query("select * from claim_vendor_document(60,array[]::text[])"),
    ).resolves.toBeDefined();
    await db.exec("reset role");
  });
});
