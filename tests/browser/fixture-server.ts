// Deterministic PostgREST fixture for browser tests. Never used by the application.
import { createServer } from "node:http";
import type { FeedEvent } from "../../src/lib/events";
import { technologyFamily } from "../../src/lib/technology";
const patch: FeedEvent = {
  id: 1,
  advisory_id: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  source_id: "nodejs",
  source_url: "https://example.org/test-only/node-update",
  source_published_at: "2026-10-24T07:00:00Z",
  published_at: "2026-10-24T07:01:00Z",
  extraction_method: "llm",
  technologies: ["nodejs", "node-js-8", "node-js-22"],
  cve_ids: ["CVE-2026-12345"],
  event_types: ["patch"],
  priority: {
    severity: "critical",
    publisher_severity: "unknown",
    known_exploited: false,
    fix_available: true,
    reasons: ["linked_severity"],
    linked_cves: [
      {
        cve: "CVE-2026-12345",
        relationship: "fixes",
        relationship_evidence: "Node.js fixes CVE-2026-12345.",
        source_id: "core-cve",
        source_url: "https://example.org/test-only/cve",
        severity: "critical",
        products: [{ name: { value: "GitLab" } }],
        metrics: [{ cvssV3_1: { baseScore: 9.8, baseSeverity: "CRITICAL" } }],
        known_exploited: false,
      },
    ],
  },
  payload: {
    security_relevant: true,
    kind: "patch",
    title: "Test fixture: Node.js security update",
    summary: "A fictional update used to verify the public feed interface.",
    evidence: "Node.js security update. Fixed in 99.0.1.",
    products: [
      {
        name: { value: "Node.js", evidence: "Node.js security update." },
        affected_versions: [],
        fixed_versions: [{ value: "99.0.1", evidence: "Fixed in 99.0.1." }],
        prerequisites: [],
      },
    ],
    related_cves: [{ value: "CVE-2026-12345", evidence: "CVE-2026-12345" }],
    severity: "unknown",
    severity_evidence: null,
  },
};
const correction: FeedEvent = {
  ...patch,
  priority: {
    severity: "unknown",
    publisher_severity: "unknown",
    known_exploited: false,
    fix_available: false,
    reasons: [],
    linked_cves: [],
  },
  id: 2,
  revision: 2,
  extraction_method: "system",
  published_at: "2026-10-24T07:02:00Z",
  event_types: ["patch", "withdrawal"],
  payload: {
    ...patch.payload,
    kind: "withdrawal",
    title: "Previous extraction withdrawn",
    summary:
      "A fictional correction for the browser test. This is not a publisher retraction.",
    evidence: "",
    products: [],
    related_cves: [],
    correction_reason: "reclassified_non_security",
    supersedes_event_id: 1,
  },
};
const ruby: FeedEvent = {
  ...patch,
  priority: {
    severity: "unknown",
    publisher_severity: "unknown",
    known_exploited: false,
    fix_available: false,
    reasons: [],
    linked_cves: [],
  },
  id: 3,
  advisory_id: "00000000-0000-0000-0000-000000000002",
  source_id: "ruby",
  source_url: "https://example.org/test-only/ruby-update",
  technologies: ["ruby"],
  cve_ids: [],
  event_types: ["advisory"],
  payload: {
    ...patch.payload,
    kind: "advisory",
    title: "Test fixture: Ruby advisory",
    products: [
      {
        name: { value: "Ruby", evidence: "Ruby advisory" },
        affected_versions: [],
        fixed_versions: [],
        prerequisites: [],
      },
    ],
    related_cves: [],
  },
};
const structured: FeedEvent = {
  ...patch,
  priority: {
    severity: "unknown",
    publisher_severity: "unknown",
    known_exploited: false,
    fix_available: false,
    reasons: [],
    linked_cves: [],
  },
  id: 4,
  published_at: "2026-10-25T08:15:00Z",
  advisory_id: "00000000-0000-0000-0000-000000000003",
  source_id: "core-osv",
  source_url: "https://example.org/test-only/structured-advisory",
  technologies: ["core-osv", "fixture-package"],
  cve_ids: [],
  event_types: ["advisory"],
  // The existing RPC stores llm; the public read derives structured from provenance.
  extraction_method: "llm",
  payload: {
    ...patch.payload,
    kind: "advisory",
    title: "Test fixture: Structured package advisory",
    summary: "A fictional structured record used to verify source references.",
    evidence: "TEST-OSV-1",
    products: [
      {
        name: {
          value: "fixture-package",
          evidence: "/affected/0/package/name",
        },
        affected_versions: [
          { value: "1.0.0", evidence: "/affected/0/versions" },
        ],
        fixed_versions: [],
        prerequisites: [],
      },
    ],
    related_cves: [],
    structured: {
      provider: "osv",
      id: "TEST-OSV-1",
      modified: "2026-10-24T07:00:00Z",
      aliases: [],
      affected: [
        {
          package: { name: "fixture-package", ecosystem: "npm" },
          versions: ["1.0.0"],
        },
      ],
      references: [],
      metrics: [
        {
          type: "CVSS_V3",
          score: "CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H",
        },
      ],
    },
  },
};
const routing = (row: FeedEvent) => ({
  ...row,
  group_id: row.group_id ?? "advisory:" + row.advisory_id,
  severity_keys:
    row.id === 2 ? ["critical", "unknown"] : [row.priority!.severity],
  important: row.id === 2 || !!row.priority?.reasons.length,
  fix_available: row.id === 2 || !!row.priority?.fix_available,
});
const rows = [structured, ruby, correction, patch].map(routing);
const exampleGroupId = "osv:GHSA-7x63-xv5r-3p2x";
const exampleMembers: FeedEvent[] = ["GHSA-7x63-xv5r-3p2x", "GO-2026-5236"].map(
  (id, i) => ({
    ...structured,
    id: 201 + i,
    advisory_id: `00000000-0000-0000-0000-00000000020${i + 1}`,
    group_id: exampleGroupId,
    source_url: "https://osv.dev/vulnerability/" + id,
    source_published_at: i ? "2026-06-25T00:00:00Z" : "2026-04-15T00:00:00Z",
    payload: {
      ...structured.payload,
      title:
        "OAuth2 Proxy authentication bypass" +
        (i ? " in github.com/oauth2-proxy/oauth2-proxy" : ""),
      summary:
        "OAuth2 Proxy may trust a client-supplied X-Forwarded-Uri header. This example shows two source records grouped under one advisory.",
      products: [
        {
          name: {
            value: "github.com/oauth2-proxy/oauth2-proxy/v7",
            evidence: "/affected/0/package/name",
          },
          affected_versions: [],
          fixed_versions: [{ value: "7.15.2", evidence: "/affected/0/ranges" }],
          prerequisites: [],
        },
      ],
      structured: { ...structured.payload.structured!, id },
    },
  }),
);
// Isolated per test/project; never changes the normal four-row fixture.
const liveStates = new Map<string, string>();
createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3038");
  if (url.pathname === "/rest/v1/rpc/advisory_sitemap_parts") {
    res.writeHead(200, { "Content-Type": "application/json" }).end("[0]");
    return;
  }
  if (url.pathname === "/rest/v1/advisory_groups") {
    const groups = rows
      .filter(
        (row) =>
          !rows.some(
            (other) =>
              other.advisory_id === row.advisory_id && other.id > row.id,
          ),
      )
      .map((row) => ({
        id: "advisory:" + row.advisory_id,
        latest_update_id: row.id,
      }))
      .filter((row) =>
        url.searchParams.getAll("latest_update_id").every((filter) => {
          if (filter.startsWith("gt."))
            return row.latest_update_id > Number(filter.slice(3));
          if (filter.startsWith("lte."))
            return row.latest_update_id <= Number(filter.slice(4));
          return true;
        }),
      )
      .sort((a, b) =>
        url.searchParams.get("order")?.includes("desc")
          ? b.latest_update_id - a.latest_update_id
          : a.latest_update_id - b.latest_update_id,
      )
      .slice(0, Number(url.searchParams.get("limit") ?? 1000));
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(groups));
    return;
  }
  const grouped = url.pathname === "/rest/v1/rpc/query_advisory_groups";
  let updates = false;
  if (grouped) {
    let body = "";
    for await (const chunk of req) body += chunk;
    const rpc = JSON.parse(body);
    updates = rpc.updates;
    if (rpc.filters.group === "osv:GHSA-2222-2222-2222") {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify(
          rpc.updates
            ? [
                {
                  id: 199,
                  group_id: rpc.filters.group,
                  revision: 2,
                  published_at: structured.published_at,
                  primary: exampleMembers[0],
                  changed: exampleMembers[0],
                  members: exampleMembers,
                  change: "membership",
                  superseded_by: [exampleGroupId],
                },
              ]
            : [],
        ),
      );
      return;
    }
    if (
      rpc.filters.q === "grouped-example" ||
      rpc.filters.group === exampleGroupId
    ) {
      res.writeHead(200, { "Content-Type": "application/json" }).end(
        JSON.stringify(
          rpc.p_after !== null && rpc.p_after >= 200
            ? []
            : [
                {
                  id: 200,
                  group_id: exampleGroupId,
                  revision: 1,
                  published_at: structured.published_at,
                  primary: exampleMembers[0],
                  changed: exampleMembers[0],
                  members: exampleMembers,
                  change: "published",
                  superseded_by: [],
                },
              ],
        ),
      );
      return;
    }
    url.pathname = "/rest/v1/events";
    for (const [key, value] of Object.entries(rpc.filters)) {
      if (key === "source") url.searchParams.set("source_id", "eq." + value);
      if (key === "group") url.searchParams.set("group_id", "eq." + value);
      if (key === "technology")
        url.searchParams.set("technology_ids", "ov.{" + value + "}");
      if (key === "type")
        url.searchParams.set("event_types", "ov.{" + value + "}");
      if (key === "cve") url.searchParams.set("cve_ids", "cs.{" + value + "}");
      if (key === "severity")
        url.searchParams.set(
          "severity_keys",
          "ov.{" + (value as string[]).join(",") + "}",
        );
      if (key === "q")
        url.searchParams.set("search_document", "plfts(simple)." + value);
      if (key === "important") url.searchParams.set("important", "eq.true");
      if (key === "fix") url.searchParams.set("fix_available", "eq.true");
    }
    url.searchParams.set("limit", rpc.p_limit);
    url.searchParams.set("order", rpc.p_after !== null ? "id.asc" : "id.desc");
    if (rpc.p_after !== null) url.searchParams.set("id", "gt." + rpc.p_after);
    if (rpc.p_before !== null) url.searchParams.set("id", "lt." + rpc.p_before);
  }
  const liveSource = url.searchParams.get("source") ?? "";
  if (
    req.method === "POST" &&
    url.pathname === "/__test/live" &&
    /^fixture-live-[a-z-]+$/.test(liveSource)
  ) {
    liveStates.set(liveSource, url.searchParams.get("state") ?? "initial");
    res.writeHead(204).end();
    return;
  }
  if (url.pathname === "/rest/v1/technology_catalog") {
    const terms = (url.searchParams.get("search_document") ?? "")
      .replace(/^fts\(simple\)\./, "")
      .split("|")
      .map((x) => x.match(/[a-z0-9]+/g) ?? []);
    const selected = url.searchParams.get("id")?.slice(4, -1).split(",");
    const options = [
      { value: "fixture-package", label: "fixture-package" },
      { value: "node-js", label: "Node.js" },
      { value: "ruby", label: "Ruby" },
    ].filter((o) => !selected || selected.includes(o.value));
    const catalog = options.filter((o) =>
      terms.some((words) =>
        words.every((w) => (o.value + " " + o.label).toLowerCase().includes(w)),
      ),
    );
    res
      .writeHead(200, { "Content-Type": "application/json" })
      .end(JSON.stringify(catalog));
    return;
  }
  if (url.pathname !== "/rest/v1/events") {
    res.writeHead(404).end();
    return;
  }
  if (url.searchParams.get("id") === "eq.999998") {
    res
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Fixture unavailable" }));
    return;
  }
  const source = url.searchParams.get("source_id")?.slice(3) ?? "";
  const state = liveStates.get(source);
  if (source === "fixture-unavailable" || state === "unavailable") {
    res
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Fixture unavailable" }));
    return;
  }
  const liveRows = [101, ...(state === "published" ? [102] : [])].map((id) => ({
    ...patch,
    id,
    source_id: source,
    payload: { ...patch.payload, title: `Live fixture event ${id}` },
  }));
  const candidates =
    url.searchParams.get("group_id") === "eq." + exampleGroupId ||
    ["eq.201", "eq.202"].includes(url.searchParams.get("id") ?? "")
      ? exampleMembers.map(routing)
      : state
        ? liveRows.map(routing)
        : rows;
  const current =
    grouped && !updates
      ? candidates.filter(
          (row) =>
            !candidates.some(
              (other) =>
                other.advisory_id === row.advisory_id && other.id > row.id,
            ),
        )
      : candidates;
  let data = current.filter((row) => {
    const selectedSeverity = url.searchParams
      .get("severity_keys")
      ?.slice(4, -1)
      .split(",");
    if (
      selectedSeverity &&
      !row.severity_keys.some((s) => selectedSeverity.includes(s))
    )
      return false;
    if (url.searchParams.get("important") === "eq.true" && !row.important)
      return false;
    if (
      url.searchParams.get("fix_available") === "eq.true" &&
      !row.fix_available
    )
      return false;
    const search = url.searchParams.get("search_document");
    if (search) {
      // Only a request-boundary stub. Actual PostgreSQL search semantics are tested in PGlite.
      const alternatives = search
        .slice(search.indexOf(".") + 1)
        .toLowerCase()
        .split("|")
        .map((part) => part.match(/[a-z0-9]+/g) ?? []);
      const document = JSON.stringify([
        row.payload,
        row.source_id,
        row.technologies,
        row.cve_ids,
        row.event_types,
      ]).toLowerCase();
      if (
        !alternatives.some(
          (words) =>
            words.length && words.every((word) => document.includes(word)),
        )
      )
        return false;
    }
    const families =
      url.searchParams.get("technology_ids") ??
      url.searchParams.get("or")?.match(/technology_ids\.(ov\.\{[^}]+\})/)?.[1];
    if (
      families &&
      !families
        .slice(4, -1)
        .split(",")
        .some((key) => row.technologies.map(technologyFamily).includes(key))
    )
      return false;
    for (const key of ["technologies", "cve_ids", "event_types"] as const) {
      const value = url.searchParams.get(key);
      if (value) {
        const keys = value.slice(4, -1).split(",");
        if (
          value.startsWith("ov.")
            ? !keys.some((k) => row[key].includes(k))
            : !keys.every((k) => row[key].includes(k))
        )
          return false;
      }
    }
    const source = url.searchParams.get("source_id");
    if (source && row.source_id !== source.slice(3)) return false;
    const group = url.searchParams.get("group_id");
    if (
      group &&
      group.slice(3) !== (row.group_id ?? "advisory:" + row.advisory_id)
    )
      return false;
    const id = url.searchParams.get("id");
    if (id?.startsWith("eq.") && row.id !== Number(id.slice(3))) return false;
    if (id?.startsWith("gt.") && row.id <= Number(id.slice(3))) return false;
    if (id?.startsWith("lt.") && row.id >= Number(id.slice(3))) return false;
    return true;
  });
  data = [...data].sort((a, b) =>
    url.searchParams.get("order")?.includes("asc") ? a.id - b.id : b.id - a.id,
  );
  res.writeHead(200, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  const selectedRows = data.slice(
    0,
    Number(url.searchParams.get("limit") ?? 100),
  );
  res.end(
    JSON.stringify(
      grouped
        ? selectedRows.map((row) => ({
            id: row.id,
            group_id: "advisory:" + row.advisory_id,
            revision: row.revision,
            published_at: row.published_at,
            primary: row,
            changed: row,
            members: [row],
            change: row.revision > 1 ? "updated" : "published",
            superseded_by: [],
          }))
        : selectedRows,
    ),
  );
}).listen(3038, "127.0.0.1");
