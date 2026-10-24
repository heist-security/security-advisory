import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, it, expect } from "vitest";
let db: PGlite;
beforeEach(async () => {
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
afterEach(async () => db.close());
const payload = {
  security_relevant: true,
  kind: "patch",
  products: [{ name: { value: "Widget" } }],
  related_cves: [{ value: "CVE-2026-12345" }],
};
async function enqueue(hash: string) {
  await db.query(
    "select enqueue_document('ruby','https://www.ruby-lang.org/review',$1,'Security update',null)",
    [hash],
  );
}
async function claim() {
  return (await db.query<any>("select * from claim_document()")).rows[0];
}
async function finish(job: any, result: object) {
  await db.query("select finish_document($1,$2,$3,'test')", [
    job.id,
    job.lease_token,
    JSON.stringify(result),
  ]);
}
it("does not publish an older relevant document after a newer non-security decision", async () => {
  await enqueue("old");
  const old = await claim();
  await enqueue("new");
  const newer = await claim();
  await finish(newer, { security_relevant: false });
  await finish(old, payload);
  expect((await db.query("select * from events")).rows).toHaveLength(0);
  expect(
    (await db.query<any>("select latest_document_id from advisories")).rows[0]
      .latest_document_id,
  ).toBe(newer.id);
});
it("publishes one explicit system correction that remains in technology, type and CVE subscriptions", async () => {
  await enqueue("one");
  await finish(await claim(), payload);
  await enqueue("two");
  await finish(await claim(), { security_relevant: false });
  await enqueue("three");
  await finish(await claim(), { security_relevant: false });
  const rows = (
    await db.query<any>(
      "select * from events where technologies @> array['widget'] and cve_ids @> array['CVE-2026-12345'] and event_types @> array['patch'] order by id",
    )
  ).rows;
  expect(rows).toHaveLength(2);
  expect(rows[1].payload.kind).toBe("withdrawal");
  expect(rows[1].extraction_method).toBe("system");
  expect(rows[1].payload.supersedes_event_id).toBe(rows[0].id);
  expect(rows[1].payload.products).toEqual([]);
});
it("fences collection work superseded by a newer feed snapshot", async () => {
  await db.exec(
    "update sources set enabled=false; update sources set enabled=true where id='ruby'",
  );
  const source = (await db.query<any>("select * from claim_source()")).rows[0];
  const stage = async (fingerprint: string) =>
    db.query("select stage_feed_entries('ruby',$1,$2)", [
      source.lease_token,
      JSON.stringify([
        {
          url: "https://www.ruby-lang.org/review",
          fingerprint,
          item: { title: fingerprint },
          feed_title: "Ruby",
        },
      ]),
    ]);
  await stage("a");
  const old = (await db.query<any>("select * from claim_feed_entry()")).rows[0]
    .entry;
  await stage("b");
  await expect(
    db.query("select complete_feed_entry($1,$2,'Old text','old',null,false)", [
      old.id,
      old.lease_token,
    ]),
  ).rejects.toThrow("lease");
  const newer = (await db.query<any>("select * from claim_feed_entry()"))
    .rows[0].entry;
  await db.query(
    "select complete_feed_entry($1,$2,'New text','new',null,false)",
    [newer.id, newer.lease_token],
  );
  expect((await db.query<any>("select body from documents")).rows[0].body).toBe(
    "New text",
  );
});
it("limits extraction claims across workers in a shared hourly bucket", async () => {
  await enqueue("one");
  await enqueue("two");
  expect((await db.query("select * from claim_document(1)")).rows).toHaveLength(
    1,
  );
  expect((await db.query("select * from claim_document(1)")).rows).toHaveLength(
    0,
  );
});
it("denies raw queues, budgets and health RPCs to anonymous and authenticated roles", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    for (const sql of [
      "select * from feed_entries",
      "select * from extraction_budget",
      "select * from claim_feed_entry()",
      "select feed_health()",
    ])
      await expect(db.query(sql)).rejects.toThrow("permission denied");
    await db.exec("reset role");
  }
});

it("corrects a publisher withdrawal that is later reclassified as non-security", async () => {
  await enqueue("withdrawn");
  await finish(await claim(), { ...payload, kind: "withdrawal" });
  await enqueue("irrelevant");
  await finish(await claim(), { security_relevant: false });
  const rows = (await db.query<any>("select * from events order by id")).rows;
  expect(rows).toHaveLength(2);
  expect(rows[1].extraction_method).toBe("system");
  expect(rows[1].payload.correction_reason).toBe("reclassified_non_security");
});
it("keeps C++ and C# technology subscription keys distinct", async () => {
  const rows = (
    await db.query<{ cpp: string; csharp: string }>(
      "select technology_key('C++') as cpp, technology_key('C#') as csharp",
    )
  ).rows;
  expect(rows[0]).toEqual({ cpp: "c-plus-plus", csharp: "c-sharp" });
});
