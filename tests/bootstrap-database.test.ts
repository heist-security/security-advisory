import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { structuredSources } from "../src/lib/structured/config";
import { syncStateSchema } from "../src/lib/structured/discover";
import { sourceSchema } from "../src/lib/feed";

const filename = "202610240006_structured_bootstrap.sql";
const folder = new URL("../supabase/migrations/", import.meta.url);
const bootstrap = readFileSync(new URL(filename, folder), "utf8");
let database: PGlite;
beforeAll(async () => {
  database = new PGlite();
  await database.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  for (const file of readdirSync(folder)
    .filter((name) => name.endsWith(".sql") && name < filename)
    .sort())
    await database.exec(readFileSync(new URL(file, folder), "utf8"));
}, 30000);
afterAll(async () => database.close());

describe.sequential("structured production bootstrap", () => {
  it("activates exactly the canonical structured sources from September 24", async () => {
    await database.exec(bootstrap);
    const rows = (
      await database.query<Record<string, unknown>>(
        "select * from sources where enabled order by id",
      )
    ).rows;
    expect(rows.map((row) => row.id)).toEqual([
      "core-cve",
      "core-kev",
      "core-osv",
    ]);
    for (const source of structuredSources) {
      const row = rows.find((r) => r.id === source.id)!;
      expect(row).toMatchObject(source);
      // The poller validates complete database rows, including nullable columns.
      expect(row.discovery_notes).toBeNull();
      expect(sourceSchema.parse(row)).toMatchObject(source);
      const sync = syncStateSchema.parse(
        (row.verification as { sync: unknown }).sync,
      );
      expect(sync.since).toBe("2026-09-24T00:00:00Z");
      expect(sync.cve_bootstrap_ref).toBe(
        source.id === "core-cve"
          ? "c21430318b4b48252dd6ba344df26d60e6354f12"
          : undefined,
      );
    }
    expect(
      (await database.query("select id from sources where not enabled")).rows,
    ).toHaveLength(374);
  });

  it("preserves advanced checkpoints, leases and vendor history on an upgrade or retry", async () => {
    const verification = {
      status: "configured",
      custom: "preserved",
      sync: {
        since: "2026-10-01T00:00:00Z",
        until: "2026-10-23T23:08:54.357Z",
        after: "2026-10-10T00:00:00.000Z|CVE-2026-12345",
        cve_bootstrap_ref: "c21430318b4b48252dd6ba344df26d60e6354f12",
      },
    };
    await database.query(
      "update sources set verification=$1, enabled=false, lease_token='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', leased_until=now()+interval '5 minutes', next_poll_at=now()+interval '1 hour' where id='core-cve'",
      [JSON.stringify(verification)],
    );
    const before = (
      await database.query(
        "select verification,lease_token,leased_until,next_poll_at from sources where id='core-cve'",
      )
    ).rows;
    await database.exec(
      "update sources set enabled=true where id='ruby'; select enqueue_document('ruby','https://www.ruby-lang.org/test','hash','Existing vendor document',null);",
    );
    await database.exec(
      'select finish_document(id,lease_token,\'{"security_relevant":true,"kind":"patch","products":[],"related_cves":[]}\'::jsonb,\'fixture\') from claim_document();',
    );
    const documents = (await database.query("select * from documents")).rows;
    const events = (await database.query("select * from events")).rows;
    expect(events).toHaveLength(1);
    await database.exec(bootstrap);
    expect(
      (
        await database.query(
          "select verification,lease_token,leased_until,next_poll_at from sources where id='core-cve'",
        )
      ).rows,
    ).toEqual(before);
    expect((await database.query("select * from documents")).rows).toEqual(
      documents,
    );
    expect((await database.query("select * from events")).rows).toEqual(events);
    expect(
      (await database.query("select id from sources where enabled order by id"))
        .rows,
    ).toEqual([{ id: "core-cve" }, { id: "core-kev" }, { id: "core-osv" }]);
  });

  it("fills missing sync state without discarding unrelated verification metadata", async () => {
    await database.exec(
      "update sources set verification='{\"note\":\"keep\"}'::jsonb where id='core-kev'",
    );
    await database.exec(bootstrap);
    expect(
      (
        await database.query<{ verification: object }>(
          "select verification from sources where id='core-kev'",
        )
      ).rows[0].verification,
    ).toEqual({
      note: "keep",
      status: "configured",
      sync: { since: "2026-09-24T00:00:00Z" },
    });
  });

  it("keeps bootstrap rows private and readable by the server role", async () => {
    for (const role of ["anon", "authenticated"]) {
      await database.exec(`set role ${role}`);
      await expect(database.query("select * from sources")).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        database.query("select * from claim_source()"),
      ).rejects.toThrow(/permission denied/);
      await database.exec("reset role");
    }
    await database.exec("set role service_role");
    expect(
      (await database.query("select * from sources where enabled")).rows,
    ).toHaveLength(3);
    await database.exec("reset role");
  });
});
