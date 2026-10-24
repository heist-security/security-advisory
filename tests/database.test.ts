import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, expect, it } from "vitest";

let database: PGlite;
beforeAll(async () => {
  database = new PGlite();
  await database.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  const directory = new URL("../supabase/migrations/", import.meta.url);
  for (const name of readdirSync(directory).filter(name => name.endsWith(".sql")).sort()) await database.exec(readFileSync(new URL(name, directory), "utf8"));
}, 30000);
afterAll(async () => { await database.close(); });
async function enqueue(hash: string, url = "https://www.ruby-lang.org/test") {
  return database.query("select enqueue_document('ruby',$1,$2,'Ruby fixed in 4.0.9',null) as added", [url, hash]);
}
type Job = { id: number; lease_token: string; attempts: number };
async function claim() { return (await database.query<Job>("select * from claim_document()")).rows[0]; }
async function finish(job: Job, relevant = true) {
  return database.query("select finish_document($1,$2,$3,'test-model')", [job.id, job.lease_token, JSON.stringify({ security_relevant: relevant, kind: "patch", related_cves: [] })]);
}
describe.sequential("durable ingestion and publication", () => {
  it("deduplicates repeated content but records a later reversion", async () => {
    expect((await enqueue("a")).rows).toEqual([{ added: true }]);
    expect((await enqueue("a")).rows).toEqual([{ added: false }]);
    await enqueue("b"); expect((await enqueue("a")).rows).toEqual([{ added: true }]);
  });
  it("publishes no-CVE patches as distinct revisions under one advisory", async () => {
    for (let i = 0; i < 3; i++) await finish(await claim());
    const rows = (await database.query<{ revision: number; advisory_id: string }>("select * from events order by id")).rows;
    expect(rows.map(r => r.revision)).toEqual([1, 2, 3]);
    expect(new Set(rows.map(r => r.advisory_id)).size).toBe(1);
  });
  it("does not claim leased jobs twice and fences a stale lease", async () => {
    await enqueue("c"); const stale = await claim();
    expect(await claim()).toBeUndefined();
    await database.query("update documents set leased_until = now() - interval '1 second' where id=$1", [stale.id]);
    const current = await claim();
    expect(current.lease_token).not.toBe(stale.lease_token);
    await expect(finish(stale)).rejects.toThrow("Lease");
    await finish(current);
  });
  it("does not let an older worker overwrite a newer revision", async () => {
    await enqueue("d"); const older = await claim(); await enqueue("e"); const newer = await claim();
    await finish(newer); await finish(older);
    const rows = (await database.query("select document_id from events order by id desc limit 1")).rows;
    expect(rows[0].document_id).toBe(newer.id);
    expect((await database.query("select * from events where document_id=$1", [older.id])).rows).toHaveLength(0);
  });
  it("retries with backoff and stops after five attempts", async () => {
    await enqueue("f", "https://www.ruby-lang.org/failing");
    for (let i = 0; i < 5; i++) {
      const job = await claim(); expect(job.attempts).toBe(i + 1);
      await database.query("select fail_document($1,$2)", [job.id, job.lease_token]);
      if (i < 4) {
        expect(await claim()).toBeUndefined();
        await database.query("update documents set available_at=now() where id=$1", [job.id]);
      }
    }
    expect(await claim()).toBeUndefined();
    expect((await database.query("select status from documents where source_url like '%failing'")).rows).toEqual([{ status: "failed" }]);
  });
  it("does not publish non-security releases", async () => {
    await enqueue("g", "https://www.ruby-lang.org/logo"); const job = await claim(); await finish(job, false);
    expect((await database.query("select * from events where document_id=$1", [job.id])).rows).toHaveLength(0);
  });
  it("denies anonymous raw document reads and ingestion RPCs", async () => {
    await database.exec("set role anon");
    await expect(database.query("select body from documents")).rejects.toThrow("permission denied");
    await expect(database.query("select * from claim_document()")).rejects.toThrow("permission denied");
    await database.exec("reset role");
  });
  it("loads exactly the reviewed catalog with metadata and adapter configuration", async () => {
    const registry = JSON.parse(readFileSync(new URL("../sources/registry.json", import.meta.url), "utf8"));
    const rows = (await database.query<{ id: string; adapter: string }>("select id,adapter from sources")).rows;
    expect(rows.length).toBe(registry.length);
    expect(new Set(rows.map(row => row.id))).toEqual(new Set(registry.map((source: { id: string }) => source.id)));
    expect((await database.query("select * from sources where homepage is null or rationale is null or verification is null")).rows).toHaveLength(0);
  });
  it("leases sources once and honors intervals, validator state, and retry backoff", async () => {
    await database.exec("update sources set enabled=false; update sources set enabled=true, poll_interval_minutes=120 where id='ruby'");
    const job = (await database.query<{ id: string; lease_token: string }>("select * from claim_source()")).rows[0];
    expect(job.id).toBe("ruby");
    expect((await database.query("select * from claim_source()")).rows).toHaveLength(0);
    await expect(database.query("select complete_source('ruby',gen_random_uuid(),true,null,'test',null)")).rejects.toThrow("lease");
    await database.query("select complete_source('ruby',$1,true,null,'etag-1','Fri, 23 Oct 2026 12:00:00 GMT')", [job.lease_token]);
    let row = (await database.query<{ delay: number; etag: string; consecutive_failures: number }>("select extract(epoch from next_poll_at-now())::int as delay,etag,consecutive_failures from sources where id='ruby'")).rows[0];
    expect(row.delay).toBeGreaterThan(7100); expect(row.etag).toBe("etag-1");
    await database.exec("update sources set next_poll_at=now() where id='ruby'");
    const retry = (await database.query<{ lease_token: string }>("select * from claim_source()")).rows[0];
    await database.query("select complete_source('ruby',$1,false,'Article unavailable',null,null)", [retry.lease_token]);
    row = (await database.query<{ delay: number; etag: string; consecutive_failures: number }>("select extract(epoch from next_poll_at-now())::int as delay,etag,consecutive_failures from sources where id='ruby'")).rows[0];
    expect(row.delay).toBeGreaterThan(290); expect(row.delay).toBeLessThanOrEqual(300);
    expect(row.etag).toBeNull(); expect(row.consecutive_failures).toBe(1);
  });
  it("reclaims an abandoned source lease and fences the old poller", async () => {
    await database.exec("update sources set next_poll_at=now() where id='ruby'");
    const old = (await database.query<{ lease_token: string }>("select * from claim_source()")).rows[0];
    await database.exec("update sources set leased_until=now()-interval '1 second' where id='ruby'");
    const current = (await database.query<{ lease_token: string }>("select * from claim_source()")).rows[0];
    expect(current.lease_token).not.toBe(old.lease_token);
    await expect(database.query("select complete_source('ruby',$1,true,null,null,null)", [old.lease_token])).rejects.toThrow("lease");
    await database.query("select complete_source('ruby',$1,true,null,null,null)", [current.lease_token]);
  });
});
