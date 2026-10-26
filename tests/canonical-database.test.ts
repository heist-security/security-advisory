import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { applyMigrations, migrations, testDatabase } from "./support/database";
import { migrateFeed } from "../scripts/migrate-feed";
import { configureSources } from "../scripts/configure-sources";
import { recollectOsv, parseOptions } from "../scripts/recollect-osv";
import { feedRepository } from "../src/adapters/postgres/feed-repository";
import { ingestionQueue } from "../src/adapters/postgres/ingestion-queue";
import { publisher } from "../src/application/publish";
import { record, payload, at } from "./support/fixtures";
import type { DocumentJob } from "../src/application/ports";
let test: Awaited<ReturnType<typeof testDatabase>>;
let feed: ReturnType<typeof feedRepository>,
  queue: ReturnType<typeof ingestionQueue>,
  publish: ReturnType<typeof publisher>;
beforeAll(async () => {
  test = await testDatabase();
  await applyMigrations(test.db, migrations.slice(0, -1));
  await configureSources(test.db, ["github-containerd-containerd"], at);
  // Reproduce a populated upgrade using the prior writer, then fence it.
  for (const url of [record().url, record().url + "?notice=2"]) {
    await test.db.query(
      "select enqueue_document('github-containerd-containerd',$1,'legacy','legacy',null)",
      [url],
    );
    const {
      rows: [job],
    } = await test.db.query<{ id: number; lease_token: string }>(
      "select * from claim_vendor_document(60,array['github-containerd-containerd'])",
    );
    await test.db.query("select finish_document($1,$2,$3::jsonb,'fixture')", [
      job.id,
      job.lease_token,
      JSON.stringify(payload()),
    ]);
  }
  await applyMigrations(test.db, migrations.slice(-1));
  feed = feedRepository(test.db);
  queue = ingestionQueue(test.db);
  publish = publisher(feed, () => new Date(at));
}, 60000);
afterAll(async () => {
  await test?.close();
});
async function enqueue(
  version: string,
  hash = version,
  url = record(version).url,
) {
  await test.db.query(
    "select enqueue_document('github-containerd-containerd',$1,$2,$3,null)",
    [url, hash, "containerd " + version],
  );
  const job = await queue.claimDocument(
    ["github-containerd-containerd"],
    10000,
  );
  expect(job).not.toBeNull();
  return job!;
}
async function finish(job: DocumentJob, p = payload()) {
  await publish(job, { payload: p, method: "llm", model: "fixture" });
}
describe.sequential("canonical storage and upgrade", () => {
  it("fails closed during import, then removes old projections while preserving raw audit", async () => {
    await expect(feed.list({ limit: 10 })).rejects.toThrow("migration");
    expect(
      await queue.claimDocument(["github-containerd-containerd"], 60),
    ).toBeNull();
    await expect(
      migrateFeed(
        test.db,
        () => {
          throw new Error("Simulated interruption");
        },
        1,
      ),
    ).rejects.toThrow("interruption");
    expect(
      (
        await test.db.query(
          "select last_event_id::int checkpoint,completed_at from feed_migration",
        )
      ).rows[0],
    ).toEqual({ checkpoint: 1, completed_at: null });
    await expect(feed.list({ limit: 10 })).rejects.toThrow("migration");
    await migrateFeed(test.db, () => {}, 1);
    await migrateFeed(test.db);
    const items = await feed.list({ limit: 10 });
    expect(items).toHaveLength(1);
    expect(items[0].fixed_versions).toEqual(["2.4.1"]);
    const { rows } = await test.db.query(
      "select to_regclass('public.events') old,to_regclass('public.advisory_groups') groups,to_regclass('public.technology_catalog') catalog,(select count(*)::int from feed_archive.events) archived",
    );
    expect(rows[0]).toEqual({
      old: null,
      groups: null,
      catalog: null,
      archived: 2,
    });
    expect(
      (await test.db.query("select extraction_result from documents")).rows[0]
        .extraction_result,
    ).toBeTruthy();
  });
  it("publishes one flat item, idempotently, with one monotonic cursor", async () => {
    const [before] = await feed.list({ limit: 10 });
    const job = await enqueue("2.0.14");
    await finish(job, payload("2.0.14"));
    const [item] = await feed.list({ limit: 10 });
    expect(item).toMatchObject({
      id: before.id,
      revision: before.revision + 1,
      fixed_versions: ["2.0.14", "2.4.1"],
    });
    expect(item.cursor).toBeGreaterThan(before.cursor);
    expect(item).not.toHaveProperty("identity_keys");
    expect(
      (await feed.list({ after: before.cursor, limit: 10 })).map((i) => i.id),
    ).toEqual([item.id]);
    await finish(await enqueue("2.0.14", "same semantic"), payload("2.0.14"));
    expect((await feed.find(item.id))!.cursor).toBe(item.cursor);
  });
  it("filters direct columns, searches evidence, and discovers technologies without projections", async () => {
    for (const filters of [
      { type: ["patch"] as const },
      { source: "github-containerd-containerd" },
      { technology: "containerd" },
      { cve: "CVE-2026-53493" },
      { severity: ["unknown"] as const },
      { fix: "1" as const },
      { important: "1" as const },
      { q: "containerd" },
    ]) {
      expect(
        await feed.list({
          ...filters,
          type: "type" in filters ? [...filters.type!] : undefined,
          severity: "severity" in filters ? [...filters.severity!] : undefined,
          limit: 10,
        }),
      ).toHaveLength(1);
    }
    expect(await feed.list({ q: "' OR true --", limit: 10 })).toEqual([]);
    expect(await feed.technologies("container")).toContainEqual({
      value: "containerd",
      label: "containerd",
    });
    expect(await feed.sitemapParts()).toEqual([0]);
    expect(await feed.sitemapItems(0, 1000)).toHaveLength(1);
  });
  it("fences expired leases, atomically records evidence, and ignores older completed work", async () => {
    const stale = await enqueue("3.0.0");
    await test.db.query(
      "update documents set leased_until=now()-interval '1 second' where id=$1",
      [stale.id],
    );
    const replacement = await queue.claimDocument(
      ["github-containerd-containerd"],
      10000,
    );
    await expect(finish(stale, payload("3.0.0"))).rejects.toThrow("Lease");
    await finish(replacement!, payload("3.0.0"));
    const older = await enqueue("3.0.0", "older"),
      newer = await enqueue("3.0.0", "newer");
    await finish(newer, { ...payload("3.0.0"), summary: "Newer facts" });
    await finish(older, { ...payload("3.0.0"), summary: "Stale facts" });
    expect(
      (await feed.list({ limit: 10 }))[0].records.find(
        (r) => r.url === older.source_url,
      )?.payload.summary,
    ).toBe("Newer facts");
    const {
      rows: [doc],
    } = await test.db.query(
      "select status,extraction_model,extraction_result from documents where id=$1",
      [newer.id],
    );
    expect(doc).toMatchObject({
      status: "done",
      extraction_model: "fixture",
      extraction_result: { summary: "Newer facts" },
    });
  });
  it("keeps corrections visible to old subscriptions and prevents anonymous data or queue access", async () => {
    const current = (await feed.list({ limit: 10 }))[0];
    for (const r of current.records)
      await finish(await enqueue("withdrawn", "non-security", r.url), {
        ...r.payload,
        security_relevant: false,
      });
    expect(await feed.list({ type: ["patch"], limit: 10 })).toEqual([]);
    const updates = await feed.list({
      type: ["patch"],
      cve: "CVE-2026-53493",
      fix: "1",
      after: current.cursor,
      limit: 10,
    });
    expect(updates).toHaveLength(1);
    expect(updates[0].kind).toBe("withdrawal");
    for (const role of ["anon", "authenticated"])
      await test.db
        .transaction(async (client) => {
          await client.query("set local role " + role);
          await expect(
            client.query("select * from feed_items"),
          ).rejects.toThrow("permission denied");
        })
        .catch((error) => {
          if (!String(error).includes("aborted")) throw error;
        });
    await expect(
      test.db.transaction(async (client) => {
        await client.query("set local role service_role");
        await client.query("delete from feed_archive.events");
      }),
    ).rejects.toThrow("permission denied");
  });
  it("queues, stages and collects a publisher through existing lease mechanics", async () => {
    await test.db.query(
      "update sources set next_poll_at=now()+interval '1 day'",
    );
    await test.db.query(
      "update sources set next_poll_at=now() where id='github-containerd-containerd'",
    );
    const source = await queue.claimSource();
    expect(source!.id).toBe("github-containerd-containerd");
    await queue.stage(source!, [
      {
        url: record("4.0.0").url,
        fingerprint: "stage1",
        item: { title: "containerd 4.0.0" },
        feed_title: "containerd",
      },
    ]);
    await queue.finishSource(source!, { entries: [], not_modified: false });
    const entry = await queue.claimEntry();
    expect(entry!.source_id).toBe("github-containerd-containerd");
    expect(
      await queue.finishEntry(entry!, {
        body: "containerd 4.0.0",
        hash: "body4",
        published_at: at,
        skipped: false,
      }),
    ).toBe(true);
    await finish(
      (await queue.claimDocument(["github-containerd-containerd"], 10000))!,
      payload("4.0.0"),
    );
    expect(await feed.list({ type: ["patch"], limit: 10 })).toHaveLength(1);
  });
  it("enforces the shared extraction budget, retries with backoff, and exposes queue health", async () => {
    await test.db.query(
      "select enqueue_document('github-containerd-containerd',$1,'budget','budget',null)",
      [record("5.0.0").url],
    );
    await test.db.query(
      "update extraction_budget set attempts=60 where hour=date_trunc('hour',now(),'UTC')",
    );
    expect(
      await queue.claimDocument(["github-containerd-containerd"], 60),
    ).toBeNull();
    const job = await queue.claimDocument(["github-containerd-containerd"], 61);
    expect(job).not.toBeNull();
    await queue.failDocument(job!, "provider_rate_limit");
    expect(
      await queue.claimDocument(["github-containerd-containerd"], 10000),
    ).toBeNull();
    expect(await queue.health()).toMatchObject({
      migration_ready: 1,
      structured_sources_configured: 1,
      extraction_pending: 1,
    });
  });
  it("configures sources transactionally without resetting checkpoints and supports bounded OSV recollection", async () => {
    const before = (
      await test.db.query(
        "select verification from sources where id='core-osv'",
      )
    ).rows[0];
    await configureSources(test.db, [], "2026-10-27T00:00:00Z");
    expect(
      (
        await test.db.query(
          "select verification from sources where id='core-osv'",
        )
      ).rows[0],
    ).toEqual(before);
    expect(
      (
        await test.db.query(
          "select enabled from sources where id='github-containerd-containerd'",
        )
      ).rows[0].enabled,
    ).toBe(false);
    expect(await recollectOsv(test.db, parseOptions(["--all"]))).toEqual({
      mode: "dry-run",
      selected: 0,
      queued: 0,
    });
  });
});
