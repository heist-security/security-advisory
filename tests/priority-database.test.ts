import type { FeedEvent } from "../src/lib/events";
import type { Priority } from "../src/lib/priority";
type PriorityEvent = FeedEvent & {
  document_id: number;
  priority: Priority;
  important: boolean;
  fix_available: boolean;
  severity_keys: string[];
};
import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { beforeEach, afterEach, it, expect } from "vitest";
import { normalizeRecord } from "../src/lib/structured/normalize";
import upstreamOsv from "./fixtures/osv-upstream.json";
let db: PGlite;
beforeEach(async (context) => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".sql"))
    .sort())
    if (!(
      context.task.name.startsWith("backfills") &&
      (file.endsWith("008_event_priority.sql") ||
        file.endsWith("009_priority_backfill.sql") ||
        file.endsWith("012_advisory_groups.sql") ||
        file.endsWith("013_osv_upstream_priority.sql") ||
        file.endsWith("014_grouped_feed_query.sql") ||
        file.endsWith("015_event_type_filters.sql") ||
        file.endsWith("016_completed_backfills.sql") ||
        file.endsWith("017_advisory_sitemap.sql"))
    ))
      await db.exec(readFileSync(new URL(file, folder), "utf8"));
}, 30000);
afterEach(async () => db.close());
const id = "CVE-2026-12345";
const quote = `Ruby fixes bugs used in GitLab ${id}.`;
const patch = {
  security_relevant: true,
  kind: "patch",
  title: quote,
  summary: "Security update",
  evidence: quote,
  severity: "unknown",
  severity_evidence: null,
  products: [
    {
      name: { value: "Ruby", evidence: quote },
      fixed_versions: [{ value: "4.0.9", evidence: "Fixed in 4.0.9." }],
      affected_versions: [],
      prerequisites: [],
    },
  ],
  related_cves: [{ value: id, evidence: quote }],
  fixed_cves: [{ cve: id, product: "Ruby", evidence: quote }],
};
const cve = (severity = "critical", kind = "advisory") => ({
  security_relevant: true,
  kind,
  title: "GitLab vulnerability",
  summary: "GitLab context",
  severity,
  products: [{ name: { value: "GitLab" }, fixed_versions: [] }],
  related_cves: [{ value: id }],
  structured: {
    provider: "cve",
    id,
    metrics: [
      { cvssV3_1: { baseSeverity: severity.toUpperCase(), baseScore: 9.9 } },
    ],
  },
});
async function publish(
  source: string,
  payload: object,
  body = quote,
  url = "https://example.test/" + source,
) {
  const job = (
    await db.query<{ id: number; lease_token: string }>(
      `insert into documents(source_id,source_url,content_hash,body,status,lease_token,leased_until)
    values($1,$2,gen_random_uuid()::text,$3,'processing',gen_random_uuid(),now()+interval '2 minutes') returning *`,
      [source, url, body],
    )
  ).rows[0];
  await db.query("select finish_document($1,$2,$3,'test')", [
    job.id,
    job.lease_token,
    JSON.stringify(payload),
  ]);
  return job.id;
}
async function latest(source = "ruby") {
  return (
    await db.query<PriorityEvent>(
      "select * from events where source_id=$1 order by id desc limit 1",
      [source],
    )
  ).rows[0];
}
it("links late CVE ratings, emits cursor revisions, and retains downgrade/withdrawal subscriptions", async () => {
  await publish("ruby", patch);
  const original = await latest();
  expect(original.priority.severity).toBe("unknown");
  expect(original.priority.reasons).toEqual(["unrated_security_fix"]);
  await publish("core-cve", cve());
  const linked = await latest();
  expect(linked.id).toBeGreaterThan(original.id);
  expect(linked.context_update).toBe(true);
  expect(linked.priority.severity).toBe("critical");
  expect(linked.payload.severity).toBe("unknown");
  expect(linked.priority.linked_cves[0]).toMatchObject({
    cve: id,
    relationship: "fixes",
    severity: "critical",
    products: [{ name: { value: "GitLab" }, fixed_versions: [] }],
  });
  // Unchanged upstream context must not produce duplicate patch notifications.
  await publish("core-cve", cve());
  expect((await latest()).id).toBe(linked.id);
  await publish("core-cve", cve("low"));
  const lower = await latest();
  expect(lower.priority.severity).toBe("low");
  expect(lower.severity_keys).toContain("critical");
  expect(lower.important).toBe(true);
  expect(lower.priority.reasons).toEqual([]);
  const documentId = await publish("ruby", {
    ...patch,
    summary: "Updated source content",
  });
  expect((await latest()).document_id).toBe(documentId);
  await publish("ruby", { security_relevant: false });
  const removed = await latest();
  expect(removed.payload.kind).toBe("withdrawal");
  expect(removed.priority.fix_available).toBe(false);
  expect(removed.fix_available).toBe(true);
  expect(removed.severity_keys).toContain("critical");
  await publish("core-cve", cve("high"));
  expect((await latest()).id).toBe(removed.id);
});
it("does not promote a merely mentioned CVE; keeps no-CVE patches and structured fixes discoverable", async () => {
  await publish("core-cve", cve());
  await publish("ruby", { ...patch, fixed_cves: [], title: "Release notes" });
  expect((await latest()).priority.severity).toBe("unknown");
  expect((await latest()).priority.linked_cves).toEqual([]);
  await publish("nodejs", { ...patch, related_cves: [], fixed_cves: [] });
  expect((await latest("nodejs")).priority.reasons).toEqual([
    "unrated_security_fix",
  ]);
  await publish("core-osv", {
    ...patch,
    kind: "advisory",
    structured: { provider: "osv", id: "GHSA-example", aliases: [id] },
  });
  const osv = await latest("core-osv");
  expect(osv.fix_available).toBe(true);
  expect(osv.priority.severity).toBe("critical");
  expect(
    (
      await db.query(
        "select id from events where severity_keys && array['critical'] and fix_available order by id desc limit 1",
      )
    ).rows,
  ).toEqual([{ id: osv.id }]);
});
it("updates known-exploited context and removes rejected CVE ratings", async () => {
  await publish("ruby", patch);
  await publish("core-cve", cve());
  const kev = {
    ...cve("unknown"),
    structured: {
      provider: "kev",
      id,
      exploitation: { known_exploited: true },
    },
  };
  await publish("core-kev", kev);
  expect((await latest()).priority.known_exploited).toBe(true);
  await publish("core-cve", cve("unknown", "withdrawal"));
  expect((await latest()).priority.severity).toBe("unknown");
  await publish("core-kev", { ...kev, kind: "withdrawal" });
  expect((await latest()).priority.known_exploited).toBe(false);
});
it("publishes upstream CVE subscriptions and ratings without merging or propagating downstream severity", async () => {
  const normalized = normalizeRecord("core-osv", upstreamOsv);
  const upstreamId = upstreamOsv.upstream[0];
  await publish("core-osv", normalized.payload, "structured", normalized.url);
  const first = await latest("core-osv");
  expect(first.cve_ids).toEqual([upstreamId]);
  expect(first.priority).toMatchObject({
    severity: "medium",
    publisher_severity: "medium",
    fix_available: true,
  });
  expect(first.severity_keys).toEqual(["medium"]);
  const upstream = {
    ...cve("low"),
    related_cves: [{ value: upstreamId, evidence: "/cveMetadata/cveId" }],
    structured: { ...cve("low").structured, id: upstreamId },
  };
  await publish("core-cve", upstream);
  const cveEvent = await latest("core-cve");
  expect(cveEvent.priority.severity).toBe("low");
  expect(cveEvent.priority.linked_cves).toEqual([]);
  const linked = await latest("core-osv");
  expect(linked.priority.linked_cves[0]).toMatchObject({
    cve: upstreamId,
    severity: "low",
    relationship_evidence: "/upstream",
  });
  expect(linked.group_id).not.toBe(cveEvent.group_id);
  const sibling = normalizeRecord("core-osv", {
    ...upstreamOsv,
    id: "CGA-sibling",
    severity: [],
  });
  await publish("core-osv", sibling.payload, "structured", sibling.url);
  const other = await latest("core-osv");
  expect(other.priority.severity).toBe("low");
  expect(other.group_id).not.toBe(linked.group_id);
  expect(other.priority.linked_cves).toHaveLength(1);
});
it("only links legacy patches from verbatim opening fix headings and preserves links on context revisions", async () => {
  const { fixed_cves: _, ...legacy } = patch;
  await publish("ruby", legacy, quote + " Fixed in 4.0.9.");
  await publish(
    "nodejs",
    legacy,
    "Unrelated announcement. ".repeat(30) + quote,
  );
  await publish("core-cve", cve());
  expect((await latest()).priority.severity).toBe("critical");
  expect((await latest("nodejs")).priority.severity).toBe("unknown");
  await publish("core-cve", cve("high"));
  expect((await latest()).priority.severity).toBe("high");
});
it("denies anonymous and authenticated access to priority helpers and event data", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec("set role " + role);
    await expect(db.query("select severity_rank('critical')")).rejects.toThrow(
      "permission denied",
    );
    await expect(db.query("select priority from events")).rejects.toThrow(
      "permission denied",
    );
    await db.exec("reset role");
  }
});

it("backfills existing patch links and filters without emitting historical notifications", async () => {
  await publish("ruby", patch);
  await publish("core-cve", cve());
  const before = (await db.query("select id from events order by id")).rows;
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610250008_event_priority.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/202610250009_priority_backfill.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.exec("begin; select * from backfill_event_priority(1); rollback;");
  expect(
    (await db.query("select last_id::int from priority_backfill")).rows,
  ).toEqual([{ last_id: 0 }]);
  expect(
    (await db.query("select processed from backfill_event_priority(1)")).rows,
  ).toEqual([{ processed: 1 }]);
  expect((await latest("core-cve")).priority).toEqual({});
  expect(
    (await db.query("select processed from backfill_event_priority(1)")).rows,
  ).toEqual([{ processed: 1 }]);
  expect(
    (await db.query("select done from backfill_event_priority(1)")).rows,
  ).toEqual([{ done: true }]);
  expect((await db.query("select id from events order by id")).rows).toEqual(
    before,
  );
  expect((await latest()).priority.severity).toBe("critical");
  expect((await latest()).important).toBe(true);
  expect((await latest()).severity_keys).toEqual(["critical"]);
});
