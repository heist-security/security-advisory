// Deterministic PostgREST fixture for browser tests. Never used by the application.
import { createServer } from "node:http";
import type { FeedEvent } from "../../src/lib/events";
const patch: FeedEvent = {
  id: 1,
  advisory_id: "test-advisory-node",
  revision: 1,
  source_id: "nodejs",
  source_url: "https://example.org/test-only/node-update",
  source_published_at: "2026-10-24T07:00:00Z",
  published_at: "2026-10-24T07:01:00Z",
  extraction_method: "llm",
  technologies: ["nodejs", "node-js"],
  cve_ids: ["CVE-2026-12345"],
  event_types: ["patch"],
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
    products: [],
    related_cves: [],
  },
};
const rows = [ruby, correction, patch];
createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://127.0.0.1:3038");
  if (url.pathname !== "/rest/v1/events") {
    res.writeHead(404).end();
    return;
  }
  if (url.searchParams.get("source_id") === "eq.fixture-unavailable") {
    res
      .writeHead(503, { "Content-Type": "application/json" })
      .end(JSON.stringify({ message: "Fixture unavailable" }));
    return;
  }
  let data = rows.filter((row) => {
    const search = url.searchParams.get("search_document");
    if (search) {
      // Only a request-boundary stub. Actual PostgreSQL search semantics are tested in PGlite.
      const words =
        search
          .slice(search.indexOf(".") + 1)
          .toLowerCase()
          .match(/[a-z0-9]+/g) ?? [];
      const document = JSON.stringify([
        row.payload,
        row.source_id,
        row.technologies,
        row.cve_ids,
        row.event_types,
      ]).toLowerCase();
      if (!words.length || !words.every((word) => document.includes(word)))
        return false;
    }
    for (const key of ["technologies", "cve_ids", "event_types"] as const) {
      const value = url.searchParams.get(key);
      if (value && !row[key].includes(value.slice(4, -1))) return false;
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
  res.end(
    JSON.stringify(data.slice(0, Number(url.searchParams.get("limit") ?? 100))),
  );
}).listen(3038, "127.0.0.1");
