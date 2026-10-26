import type { FeedEvent } from "../src/lib/events";
import type { Priority } from "../src/lib/priority";
type GroupMember = FeedEvent & { priority: Priority };
type GroupResult = {
  id: number;
  group_id: string;
  primary: GroupMember;
  changed: GroupMember;
  members: GroupMember[];
  superseded_by: string[];
};
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { normalizeRecord } from "../src/lib/structured/normalize";

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
beforeEach(async () => {
  await db.exec(
    "truncate documents restart identity cascade; update advisory_group_backfill set last_id=0,completed_at=null;",
  );
});
afterAll(async () => db?.close());

const ghsa = "GHSA-7x63-xv5r-3p2x";
const go = "GO-2026-5236";
const key = "osv:" + ghsa;
const affected = {
  package: { ecosystem: "Go", name: "github.com/oauth2-proxy/oauth2-proxy/v7" },
  ranges: [
    { type: "SEMVER", events: [{ introduced: "7.5.0" }, { fixed: "7.15.2" }] },
  ],
};
function record(id = ghsa) {
  return normalizeRecord("core-osv", {
    id,
    modified: "2026-10-25T00:00:00Z",
    published: "2026-04-15T00:00:00Z",
    aliases: [ghsa, go, "CVE-2026-40575", "CVE-2026-76835"],
    summary:
      id === ghsa
        ? "OAuth2 authentication bypass"
        : "Go mirror of the OAuth2 authentication bypass",
    details: "Source-specific details.",
    affected: [
      affected,
      ...(id === go
        ? [
            {
              package: { ecosystem: "Go", name: "legacy-package" },
              versions: ["1.0.0"],
            },
          ]
        : []),
    ],
    references: [
      {
        url:
          "https://github.com/oauth2-proxy/oauth2-proxy/security/advisories/" +
          ghsa,
      },
    ],
    database_specific:
      id === ghsa ? { github_reviewed: true, severity: "CRITICAL" } : {},
  }).payload;
}
async function publish(
  payload = record(),
  source = "core-osv",
  url = "https://osv.dev/vulnerability/" + payload.structured.id,
) {
  const job = (
    await db.query<{ id: number; lease_token: string }>(
      `insert into documents(source_id,source_url,content_hash,body,status,lease_token,leased_until)
     values($1,$2,gen_random_uuid()::text,'Source body','processing',gen_random_uuid(),now()+interval '2 minutes') returning *`,
      [source, url],
    )
  ).rows[0];
  await db.query("select finish_document($1,$2,$3,'test')", [
    job.id,
    job.lease_token,
    JSON.stringify(payload),
  ]);
}
async function groups(
  filters = {},
  after: number | null = null,
  before: number | null = null,
  limit = 100,
  updates = false,
) {
  return (
    await db.query<{ item: GroupResult }>(
      "select query_advisory_groups($1,$2,$3,$4,$5) item",
      [JSON.stringify(filters), limit, after, before, updates],
    )
  ).rows.map((r) => r.item);
}

it("lists only occupied sitemap parts and restricts the query to the server role", async () => {
  const parts = async () =>
    (
      await db.query<{ parts: number[] }>(
        "select advisory_sitemap_parts() parts",
      )
    ).rows[0].parts;
  expect(await parts()).toEqual([]);
  await publish();
  expect(await parts()).toEqual([0]);
  await db.exec("update advisory_groups set latest_update_id=50001");
  expect(await parts()).toEqual([50]);
  await db.exec("update advisory_groups set active=false");
  expect(await parts()).toEqual([]);
  const permissions = await db.query<{ role: string; allowed: boolean }>(
    "select role,has_function_privilege(role,'advisory_sitemap_parts()','execute') allowed from unnest(array['anon','authenticated','service_role']) role",
  );
  expect(permissions.rows).toEqual([
    { role: "anon", allowed: false },
    { role: "authenticated", allowed: false },
    { role: "service_role", allowed: true },
  ]);
});

it("groups matching OSV copies, prefers the reviewed primary and retains every source's evidence", async () => {
  await publish();
  const first = (await groups())[0];
  await publish(record(go));
  const rows = await groups();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({
    id: first.id,
    group_id: key,
    primary: { payload: { structured: { id: ghsa } } },
  });
  expect(rows[0].members).toHaveLength(2);
  expect(
    rows[0].members.find((m) => m.payload.structured?.id === go)!.payload
      .products,
  ).toHaveLength(2);
  expect(rows[0].primary.payload.products).toHaveLength(1);
  expect(await groups({}, first.id, null, 100, true)).toHaveLength(0);
  expect((await db.query("select distinct group_id from events")).rows).toEqual(
    [{ group_id: key }],
  );
});

it("does not merge the later bypass, unrelated packages, title matches or CVE mentions", async () => {
  await publish();
  const later = record("GO-2026-9999");
  later.structured.affected = [
    {
      ...affected,
      ranges: [
        {
          type: "SEMVER",
          events: [{ introduced: "7.15.2" }, { fixed: "7.15.5" }],
        },
      ],
    },
  ];
  await publish(later);
  const distro = record("BIT-oauth2-proxy-2026-40575");
  distro.structured.affected = [
    { ...affected, package: { ecosystem: "Bitnami", name: "oauth2-proxy" } },
  ];
  await publish(distro);
  const mention = record("GO-2026-8888");
  mention.structured.references = [
    "https://github.com/oauth2-proxy/oauth2-proxy",
  ];
  await publish(mention);
  expect(await groups()).toHaveLength(4);
});

it("filters matching members before group pagination, with all conditions on the same member", async () => {
  await publish({ ...record(), title: "Reviewed exclusive finding" });
  await publish(record(go));
  const unrelated = record("TEST-123");
  unrelated.structured.references = [];
  await publish(unrelated);
  expect((await groups({ technology: "legacy-package" }))[0].group_id).toBe(
    key,
  );
  expect(
    await groups({ q: "mirror", technology: "legacy-package" }),
  ).toHaveLength(1);
  expect(
    await groups({ q: "reviewed exclusive", technology: "legacy-package" }),
  ).toHaveLength(0);
  const first = await groups({}, null, null, 1);
  const second = await groups({}, null, first[0].id, 1);
  expect(first[0].group_id).not.toBe(second[0].group_id);
  expect(await groups({}, null, second[0].id, 1)).toHaveLength(0);
});

it("matches any selected type before pagination and keeps conditions on the same member", async () => {
  await publish({ ...record(), title: "Advisory-only wording" });
  await publish({ ...record(go), kind: "patch" });
  const unrelated = record("TEST-123");
  unrelated.structured.references = [];
  await publish({ ...unrelated, kind: "mitigation", severity: "low" });
  const union = await groups({ type: "patch,mitigation" });
  expect(union).toHaveLength(2);
  expect(await groups({ type: "patch" })).toHaveLength(1);
  expect(await groups({ type: "patch", severity: ["critical"] })).toHaveLength(
    1,
  );
  expect(await groups({ type: "patch", severity: ["low"] })).toHaveLength(0);
  expect(
    await groups({ type: "patch,mitigation", q: "Advisory-only wording" }),
  ).toHaveLength(0);
  const first = await groups({ type: "patch,mitigation" }, null, null, 1);
  const next = await groups({ type: "patch,mitigation" }, null, first[0].id, 1);
  expect(first[0].group_id).not.toBe(next[0].group_id);
  expect(
    await groups({ type: "patch,mitigation" }, null, next[0].id, 1),
  ).toHaveLength(0);
  await publish({ ...record(go), kind: "withdrawal" });
  const corrections = await groups(
    { type: "patch,mitigation" },
    union[0].id,
    null,
    100,
    true,
  );
  expect(
    corrections.some((row) => row.changed.payload.kind === "withdrawal"),
  ).toBe(true);
});

it("publishes changed secondary evidence, withdrawals and reversions with immutable update snapshots", async () => {
  await publish();
  await publish(record(go));
  const first = (await groups())[0];
  const changed = record(go);
  changed.summary = "New mitigation instructions from Go.";
  await publish(changed);
  let updates = await groups({}, first.id, null, 100, true);
  expect(updates).toHaveLength(1);
  expect(updates[0].changed.payload.summary).toBe(changed.summary);
  const updatedCursor = updates[0].id;
  await publish({ ...changed, kind: "withdrawal" });
  updates = await groups(
    { technology: "legacy-package", severity: ["critical"] },
    updatedCursor,
    null,
    100,
    true,
  );
  expect(updates).toHaveLength(1);
  expect(updates[0].changed.payload.kind).toBe("withdrawal");
  expect(updates[0].primary.payload.structured?.id).toBe(ghsa);
  await publish(record(go));
  expect(await groups({}, updates[0].id, null, 100, true)).toHaveLength(1);
  expect(
    (await groups({}, first.id, null, 1, true))[0].changed.payload.summary,
  ).toBe(changed.summary);
});

it("keeps source attribution when the primary withdraws and retains the remaining source", async () => {
  await publish();
  await publish(record(go));
  await publish({ ...record(), kind: "withdrawal" });
  const rows = await groups();
  expect(rows).toHaveLength(1);
  expect(rows[0].primary.payload.structured?.id).toBe(go);
  expect(
    rows[0].members.find((m) => m.payload.structured?.id === ghsa)!.payload
      .kind,
  ).toBe("withdrawal");
});

it("coalesces linked context revisions and delivers a downgrade once to previous severity subscriptions", async () => {
  await publish();
  await publish(record(go));
  const cursor = (await groups())[0].id;
  await publish({ ...record(), severity: "low" });
  const updates = await groups(
    { severity: ["critical"] },
    cursor,
    null,
    100,
    true,
  );
  expect(updates).toHaveLength(1);
  expect(updates[0].members.every((m) => m.priority.severity === "low")).toBe(
    true,
  );
  const next = updates[0].id;
  const metadata = record();
  metadata.severity = "low";
  metadata.structured.modified = "2026-10-26T00:00:00Z";
  await publish(metadata);
  expect(await groups({}, next, null, 100, true)).toHaveLength(0);
});

it("records membership corrections when an anchor arrives late or ranges diverge", async () => {
  await publish(record(go));
  const first = (await groups())[0];
  await publish();
  expect(await groups()).toHaveLength(1);
  const updates = await groups({}, first.id, null, 100, true);
  expect(
    updates.find((u) => u.group_id === first.group_id)!.superseded_by,
  ).toEqual([key]);
  const changed = record(go);
  changed.structured.affected = [{ ...affected, versions: ["99.0.0"] }];
  await publish(changed);
  expect(await groups()).toHaveLength(2);
});

it("backfills only current source states in resumable batches without rewriting raw event IDs", async () => {
  await db.exec("alter table events disable trigger publish_advisory_group");
  await publish();
  await publish({ ...record(), summary: "Latest source description" });
  await publish(record(go));
  const before = (
    await db.query(
      "select id,revision,published_at,payload from events order by id",
    )
  ).rows;
  await db.exec("alter table events enable trigger publish_advisory_group");
  for (let i = 0; i < 10; i++) {
    const result = (
      await db.query<{ done: boolean }>(
        "select * from backfill_advisory_groups(1)",
      )
    ).rows[0];
    if (result.done) break;
  }
  expect(await groups()).toHaveLength(1);
  expect(await groups({}, 0, null, 100, true)).toHaveLength(1);
  expect((await groups())[0].members).toHaveLength(2);
  expect(
    (
      await db.query(
        "select id,revision,published_at,payload from events order by id",
      )
    ).rows,
  ).toEqual(before);
  expect(
    (
      await db.query<{ processed: number }>(
        "select processed from backfill_advisory_groups(1)",
      )
    ).rows[0].processed,
  ).toBe(0);
});

it("keeps group tables and RPCs private to the backend", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    for (const sql of [
      "select * from advisory_groups",
      "select * from advisory_group_updates",
      "select * from query_advisory_groups()",
      "select * from backfill_advisory_groups()",
    ])
      await expect(db.query(sql)).rejects.toThrow("permission denied");
    await db.exec("reset role");
  }
});

it("requires bounded evidence and rejects conflicts between mirrors' additional packages", async () => {
  const unknown = record();
  unknown.structured.affected = [
    {
      package: affected.package,
      ranges: [{ type: "SEMVER", events: [{ introduced: "0" }] }],
    },
  ];
  const unknownMirror = {
    ...record(go),
    structured: {
      ...record(go).structured,
      affected: unknown.structured.affected,
    },
  };
  await publish(unknown);
  await publish(unknownMirror);
  expect(await groups()).toHaveLength(2);
  await publish(record());
  const a = record(go);
  a.structured.affected = [
    affected,
    { package: { ecosystem: "Go", name: "additional" }, versions: ["1.0.0"] },
  ];
  await publish(a);
  const b = record("GO-2026-9998");
  b.structured.affected = [
    affected,
    { package: { ecosystem: "Go", name: "additional" }, versions: ["2.0.0"] },
  ];
  await publish(b);
  expect(await groups()).toHaveLength(3);
});

it("bounds page reads on a populated feed, including cached plans and selective searches", async () => {
  await db.exec(
    readFileSync(
      new URL("./fixtures/group-query.sql", import.meta.url),
      "utf8",
    ),
  );
  // Flush the bulk-load GIN pending list before measuring query plans.
  await db.exec("vacuum analyze events");
  // Buffer accesses measure database work without flaky wall-clock thresholds.
  // Large search documents reproduce the production cost of testing every group.
  // Sparse matches must use the search index, including the update/RSS path.
  await db.exec("set plan_cache_mode=force_generic_plan");
  try {
    const cases: {
      filters: Record<string, string | string[] | undefined>;
      after: number | null;
      before: number | null;
      updates: boolean;
      first: number | undefined;
      count: number;
    }[] = [
      {
        filters: {},
        after: null,
        before: null,
        updates: false,
        first: 6000,
        count: 21,
      },
      {
        filters: {},
        after: null,
        before: 3000,
        updates: false,
        first: 2999,
        count: 21,
      },
      {
        filters: {},
        after: 0,
        before: null,
        updates: false,
        first: 1,
        count: 21,
      },
      {
        filters: {},
        after: null,
        before: null,
        updates: true,
        first: 6000,
        count: 21,
      },
      {
        filters: {},
        after: 0,
        before: null,
        updates: true,
        first: 1,
        count: 21,
      },
      {
        filters: { cve: "CVE-2026-10001" },
        after: null,
        before: null,
        updates: false,
        first: 1,
        count: 1,
      },
      {
        filters: { q: "no-such-query-fixture" },
        after: null,
        before: null,
        updates: false,
        first: undefined,
        count: 0,
      },
      {
        filters: { q: "fixture", source: "core-cve" },
        after: null,
        before: null,
        updates: false,
        first: 6000,
        count: 21,
      },
    ];
    for (const updates of [false, true]) {
      cases.push(
        {
          filters: { q: "Brotli" },
          after: null,
          before: null,
          updates,
          first: 3000,
          count: 2,
        },
        {
          filters: { q: "Brotli" },
          after: null,
          before: 3000,
          updates,
          first: 1,
          count: 1,
        },
        {
          filters: { q: "Brotli" },
          after: 0,
          before: null,
          updates,
          first: 1,
          count: 2,
        },
        {
          filters: { q: "no-such-query-fixture" },
          after: null,
          before: null,
          updates,
          first: undefined,
          count: 0,
        },
      );
      for (const filters of [
        { type: "patch" },
        { severity: ["critical"] },
        { type: "patch", severity: ["critical"] },
        { important: "1" },
        { fix: "1" },
      ]) {
        cases.push(
          {
            filters,
            after: null,
            before: null,
            updates,
            first: 3000,
            count: 2,
          },
          { filters, after: null, before: 3000, updates, first: 1, count: 1 },
          { filters, after: 0, before: null, updates, first: 1, count: 2 },
        );
      }
      for (const filters of [
        { type: "mitigation" },
        { type: "patch", severity: ["low"] },
      ]) {
        cases.push({
          filters,
          after: null,
          before: null,
          updates,
          first: undefined,
          count: 0,
        });
      }
    }
    for (const entry of cases) {
      const rows = await groups(
        entry.filters,
        entry.after,
        entry.before,
        21,
        entry.updates,
      );
      expect(rows).toHaveLength(entry.count);
      expect(rows[0]?.id).toBe(entry.first);
      const result = await db.query<{
        "QUERY PLAN": { Plan: Record<string, number> }[];
      }>(
        "explain (analyze,buffers,format json) select * from query_advisory_groups($1,21,$2,$3,$4)",
        [
          JSON.stringify(entry.filters),
          entry.after,
          entry.before,
          entry.updates,
        ],
      );
      const plan = result.rows[0]["QUERY PLAN"][0].Plan;
      expect(plan["Actual Rows"]).toBe(entry.count);
      // A broad query matches all 6,000 large documents. Sparse/empty searches
      // must stay independent of that archive size (the previous plan exceeds
      // 500 reads even for two matches, and scans every update snapshot).
      expect(
        plan["Shared Hit Blocks"] + plan["Shared Read Blocks"],
        JSON.stringify(entry),
      ).toBeLessThan(
        entry.filters.q === "fixture"
          ? 25000
          : entry.filters.q
            ? 500
            : Object.keys(entry.filters).length
              ? 200
              : 2000,
      );
    }
  } finally {
    await db.exec("reset plan_cache_mode");
  }
}, 60000);
