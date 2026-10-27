import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { applyMigrations, migrations, testDatabase } from "./support/database";
import { migrateFeed } from "../scripts/migrate-feed";
import { configureSources } from "../scripts/configure-sources";
import { recollectOsv, parseOptions } from "../scripts/recollect-osv";
import { feedRepository } from "../src/adapters/postgres/feed-repository";
import { ingestionQueue } from "../src/adapters/postgres/ingestion-queue";
import { publisher } from "../src/application/publish";
import { record, payload, at, fact } from "./support/fixtures";
import type { DocumentJob } from "../src/application/ports";
let test: Awaited<ReturnType<typeof testDatabase>>;
const cutover = migrations.indexOf("202610260021_canonical_feed.sql");
let legacyPending: DocumentJob, legacyCompleted: DocumentJob;
let feed: ReturnType<typeof feedRepository>,
  queue: ReturnType<typeof ingestionQueue>,
  publish: ReturnType<typeof publisher>;
beforeAll(async () => {
  test = await testDatabase();
  await applyMigrations(test.db, migrations.slice(0, cutover));
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
  // The old writer can complete a newer non-security document without an event.
  for (const revision of ["pending-security", "completed-non-security"]) {
    await test.db.query(
      "select enqueue_document('github-containerd-containerd',$1,$2,$2,null)",
      [record("eventless").url, revision],
    );
    const {
      rows: [{ job }],
    } = await test.db.query<{ job: DocumentJob }>(
      "select to_jsonb(d) job from claim_vendor_document(60,array['github-containerd-containerd']) d",
    );
    if (revision === "pending-security") legacyPending = job;
    else legacyCompleted = job;
  }
  await test.db.query("select finish_document($1,$2,$3::jsonb,'fixture')", [
    legacyCompleted.id,
    legacyCompleted.lease_token,
    JSON.stringify({ ...payload(), security_relevant: false }),
  ]);
  await test.db.query("select fail_document($1,$2,'retry')", [
    legacyPending.id,
    legacyPending.lease_token,
  ]);
  await test.db.query("update documents set available_at=now() where id=$1", [
    legacyPending.id,
  ]);
  await applyMigrations(test.db, migrations.slice(cutover, cutover + 1));
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
    await applyMigrations(test.db, migrations.slice(cutover + 1));
    expect(
      (
        await test.db.query(
          "select value,item_count::int item_count from feed_technologies order by value",
        )
      ).rows,
    ).toEqual([
      { value: "containerd", item_count: 1 },
      { value: "github-containerd-containerd", item_count: 1 },
    ]);
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
      (
        await test.db.query(
          "select extraction_result from documents where source_url=$1",
          [record().url],
        )
      ).rows[0].extraction_result,
    ).toBeTruthy();
  });
  it("preserves newer non-security decisions when older documents retry after cutover", async () => {
    const job = await queue.claimDocument(
      ["github-containerd-containerd"],
      10000,
    );
    expect(job!.id).toBe(legacyPending.id);
    await finish(job!, payload("0.1.0", ["CVE-2026-99990"]));
    expect(await feed.list({ limit: 10 })).toHaveLength(1);
    const {
      rows: [document],
    } = await test.db.query(
      "select status,extraction_result from documents where id=$1",
      [legacyCompleted.id],
    );
    expect(document).toEqual({ status: "done", extraction_result: null });
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
    expect(
      (await feed.technologies({ q: "container", limit: 20 })).data,
    ).toContainEqual({
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
  it("loads the complete OSV peer scope after a mirror changes anchors", async () => {
    const g1 = "GHSA-2345-cfgh-jmpq",
      g2 = "GHSA-6789-qrvw-x234";
    async function save(
      id: string,
      anchor: string,
      packages: string[],
      summary = "Initial claim",
    ) {
      const data = {
        ...payload(),
        kind: "advisory" as const,
        title: id,
        summary,
        fixed_cves: [],
        products: packages.map((name) => ({
          name: fact(name),
          affected_versions: [],
          fixed_versions: [fact("1.2.3")],
          prerequisites: [],
        })),
        structured: {
          provider: "osv" as const,
          id,
          modified: at,
          aliases: [anchor],
          references: ["https://github.com/advisories/" + anchor],
          provider_metadata: { github_reviewed: id === anchor },
          affected: packages.map((name) => ({
            package: { ecosystem: "npm", name },
            ranges: [
              {
                type: "SEMVER",
                events: [{ introduced: "0" }, { fixed: "1.2.3" }],
              },
            ],
          })),
        },
      };
      await test.db.query("select enqueue_document('core-osv',$1,$2,$2,null)", [
        "https://osv.dev/vulnerability/" + id,
        JSON.stringify(data),
      ]);
      const job = await queue.claimDocument(["core-osv"]);
      await publish(job!, {
        payload: data,
        method: "structured",
        model: "fixture",
      });
    }
    await save(g1, g1, ["x", "y"]);
    await save(g2, g2, ["x"]);
    await save("MIRROR-M", g2, ["x"]);
    await save("MIRROR-U", g2, ["x"]);
    await save("MIRROR-U", g1, ["x"]);
    await save("MIRROR-N", g1, ["y"]);
    const before = await feed.list({ source: "core-osv", limit: 100 });
    expect(before).toHaveLength(4);
    const mirror = before.find((item) =>
      item.records.some((r) => r.payload.structured?.id === "MIRROR-U"),
    )!;
    expect(mirror.records).toHaveLength(1);
    await save("MIRROR-M", g2, ["x"], "Revised source details");
    const after = await feed.list({ source: "core-osv", limit: 100 });
    expect(after).toHaveLength(4);
    expect(after.find((item) => item.id === mirror.id)?.records).toEqual(
      mirror.records,
    );
    expect(
      after.find((item) =>
        item.records.some((r) => r.payload.structured?.id === g1),
      )!.records,
    ).toHaveLength(1);
  });
  it("pages and searches active technologies, keeping shared terms until their last item disappears", async () => {
    await configureSources(test.db, ["github-containerd-containerd"], at);
    const products = [
      ...Array.from(
        { length: 25 },
        (_, i) => "Widget-" + String(i).padStart(2, "0"),
      ),
      "Node.js",
    ];
    const data = {
      ...payload(),
      kind: "advisory" as const,
      fixed_cves: [],
      products: products.map((name) => ({
        name: fact(name),
        affected_versions: [],
        fixed_versions: [],
        prerequisites: [],
      })),
    };
    await finish(await enqueue("technology-search"), data);
    const seen: string[] = [];
    let after: string | undefined;
    for (let page = 0; page < 3; page++) {
      const result = await feed.technologies({ q: "WIDGET", after, limit: 10 });
      seen.push(...result.data.map((item) => item.value));
      expect(result.data).toHaveLength(page < 2 ? 10 : 5);
      expect(result.next_after).toBe(
        page < 2 ? result.data.at(-1)!.value : null,
      );
      after = result.next_after ?? undefined;
    }
    expect(seen).toEqual(
      products.slice(0, -1).map((value) => value.toLowerCase()),
    );
    expect(
      (await feed.technologies({ q: "dget-1", limit: 20 })).data.map(
        (item) => item.value,
      ),
    ).toEqual(seen.slice(10, 20));
    expect(await feed.technologies({ q: "nodejs", limit: 1 })).toEqual({
      data: [{ value: "node-js", label: "Node.js" }],
      next_after: null,
    });
    expect(
      await feed.technologies({ q: "widget", after: "zzzz", limit: 20 }),
    ).toEqual({ data: [], next_after: null });
    await finish(await enqueue("technology-shared"), {
      ...data,
      products: data.products.slice(-1),
    });
    await finish(await enqueue("technology-search", "withdrawn"), {
      ...data,
      security_relevant: false,
    });
    expect((await feed.technologies({ q: "widget", limit: 20 })).data).toEqual(
      [],
    );
    expect(
      (await feed.technologies({ q: "nodejs", limit: 20 })).data,
    ).toHaveLength(1);
    await test.db.query(
      "delete from feed_items where record_ids @> $1::text[]",
      [[record("technology-shared").id]],
    );
    expect((await feed.technologies({ q: "nodejs", limit: 20 })).data).toEqual(
      [],
    );
  });
  it("keeps technology reference counts consistent through imports, regrouping and corrections", async () => {
    const actual = await test.db.query(
      "select value,item_count::int item_count from feed_technologies order by value",
    );
    const expected = await test.db.query(
      'select key value,count(*)::int item_count from feed_items f cross join lateral (select distinct unnest(f.technology_ids) key) t where active and length(key) between 1 and 100 group by key order by key collate "C"',
    );
    expect(actual.rows).toEqual(expected.rows);
  });
});
