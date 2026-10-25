// Deterministic PostgREST fixture for browser tests. Never used by the application.
import { createServer } from "node:http";
import type { FeedEvent } from "../../src/lib/events";
import { technologyOptions } from "../../src/lib/technology-options";
import { technologyFamily } from "../../src/lib/technology";
const patch: FeedEvent = {
  id: 1,
  advisory_id: "test-advisory-node",
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
        metrics: [],
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
  advisory_id: "test-advisory-ruby",
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
  advisory_id: "test-advisory-osv",
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
    },
  },
};
const routing = (row: FeedEvent) => ({
  ...row,
  severity_keys:
    row.id === 2 ? ["critical", "unknown"] : [row.priority!.severity],
  important: row.id === 2 || !!row.priority?.reasons.length,
  fix_available: row.id === 2 || !!row.priority?.fix_available,
});
const rows = [structured, ruby, correction, patch].map(routing);
// Isolated per test/project; never changes the normal four-row fixture.
const liveStates = new Map<string, string>();
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3038");
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
    const options = technologyOptions(rows).filter(
      (o) => !selected || selected.includes(o.value),
    );
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
  let data = (state ? liveRows.map(routing) : rows).filter((row) => {
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
    const id = url.searchParams.get("id");
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
      url.searchParams.get("select") ===
        "technologies,products:payload->products"
        ? selectedRows.map((row) => ({
            technologies: row.technologies,
            products: row.payload.products,
          }))
        : selectedRows,
    ),
  );
}).listen(3038, "127.0.0.1");
