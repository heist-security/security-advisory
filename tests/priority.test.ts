import { afterEach, expect, it, vi } from "vitest";
import { parseEventQuery, filterQuery } from "../src/lib/filters";
import { events, rss, type FeedEvent } from "../src/lib/events";
import { validateEvidence, type Extraction } from "../src/lib/schema";
import type { Priority } from "../src/lib/priority";
import { technologyOptions } from "../src/lib/technology-options";
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("normalizes technology unions while preserving single-technology URLs", () => {
  const query = parseEventQuery(
    new URLSearchParams({ technology: "Ruby,Node.js,Ruby,C++,C#" }),
  );
  expect(query.technology).toBe("c-plus-plus,c-sharp,node-js,ruby");
  expect(parseEventQuery(filterQuery(query)).technology).toBe(query.technology);
  for (const technology of [
    "ruby,",
    "!!!",
    Array(11).fill("ruby").join(","),
    "x".repeat(101),
  ])
    expect(() =>
      parseEventQuery(new URLSearchParams({ technology })),
    ).toThrow();
  expect(() =>
    parseEventQuery(new URLSearchParams("technology=ruby&technology=node-js")),
  ).toThrow();
});
it("filters technology unions in the database before pagination", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json([]));
  vi.stubGlobal("fetch", fetcher);
  await events({
    technology: "node-js,ruby",
    severity: ["critical"],
    after: 5,
    limit: 1,
  });
  expect(
    Object.fromEntries(new URL(String(fetcher.mock.calls[0][0])).searchParams),
  ).toMatchObject({
    technology_families: "ov.{node-js,ruby}",
    severity_keys: "ov.{critical}",
    id: "gt.5",
    limit: "1",
  });
});
it("suggests deduplicated public technology keys with product labels and retained correction keys", () => {
  const rows = [
    {
      technologies: ["node-js", "old-product"],
      payload: { products: [{ name: { value: "Node.js" } }] },
    },
  ];
  expect(technologyOptions([...rows, ...rows], "node")).toEqual([
    { value: "node-js", label: "Node.js" },
  ]);
  expect(technologyOptions(rows, "old")).toEqual([
    { value: "old-product", label: "old-product" },
  ]);
});
it("canonicalizes multiple severities and rejects ambiguous subscription parameters", () => {
  const q = parseEventQuery(
    new URLSearchParams("severity=high,critical,high&important=1&fix=1"),
  );
  expect(q.severity).toEqual(["critical", "high"]);
  expect(filterQuery(q).toString()).toBe(
    "important=1&fix=1&severity=critical%2Chigh",
  );
  for (const p of [
    "severity=critical,invalid",
    "severity=high&severity=low",
    "important=true",
    "fix=0",
  ])
    expect(() => parseEventQuery(new URLSearchParams(p))).toThrow();
});
it("applies all priority filters in the database before the cursor limit", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetcher = vi.fn(
    async (_input: RequestInfo | URL, _init?: RequestInit) => Response.json([]),
  );
  vi.stubGlobal("fetch", fetcher);
  await events({
    severity: ["critical", "high"],
    important: "1",
    fix: "1",
    after: 123,
    limit: 1,
  });
  const u = new URL(String(fetcher.mock.calls[0][0]));
  expect(Object.fromEntries(u.searchParams)).toMatchObject({
    severity_keys: "ov.{critical,high}",
    important: "eq.true",
    fix_available: "eq.true",
    id: "gt.123",
    limit: "1",
  });
});
const text = "Ruby fixes CVE-2026-12345 in 4.0.9.";
const patch: Extraction = {
  security_relevant: true,
  kind: "patch",
  title: "Ruby update",
  summary: "Fix",
  evidence: text,
  products: [
    {
      name: { value: "Ruby", evidence: text },
      affected_versions: [],
      fixed_versions: [{ value: "4.0.9", evidence: text }],
      prerequisites: [],
    },
  ],
  related_cves: [{ value: "CVE-2026-12345", evidence: text }],
  fixed_cves: [{ cve: "CVE-2026-12345", product: "Ruby", evidence: text }],
  severity: "unknown",
  severity_evidence: null,
};
it("requires a source-backed fix relationship, not a CVE mention or a negated/future fix", () => {
  expect(validateEvidence(patch, text).fixed_cves).toHaveLength(1);
  for (const evidence of [
    "Ruby mentions CVE-2026-12345.",
    "Ruby does not fix CVE-2026-12345.",
    "Ruby will fix CVE-2026-12345.",
    "Ruby fixes CVE-2026-99999.",
  ])
    expect(() =>
      validateEvidence(
        { ...patch, fixed_cves: [{ ...patch.fixed_cves![0], evidence }] },
        text + evidence,
      ),
    ).toThrow();
  expect(() =>
    validateEvidence(
      {
        ...patch,
        fixed_cves: [{ ...patch.fixed_cves![0], product: "GitLab" }],
      },
      text,
    ),
  ).toThrow();
});
it("exposes original rating attribution and context-only updates in RSS", () => {
  const priority: Priority = {
    severity: "critical",
    publisher_severity: "unknown",
    known_exploited: false,
    fix_available: true,
    reasons: ["linked_severity"],
    linked_cves: [
      {
        cve: "CVE-2026-12345",
        relationship: "fixes",
        relationship_evidence: text,
        source_id: "core-cve",
        source_url: "https://example.test/cve",
        severity: "critical",
        products: [{ name: { value: "GitLab" } }],
        metrics: [],
        known_exploited: false,
      },
    ],
  };
  const row = {
    id: 1,
    revision: 2,
    published_at: "2026-10-25T00:00:00Z",
    source_url: "https://example.test/patch",
    extraction_method: "llm",
    payload: patch,
    priority,
    context_update: true,
  } as FeedEvent;
  const xml = rss([row], "https://example.test");
  expect(xml).toContain("Linked Critical CVE");
  expect(xml).toContain("GitLab");
  expect(xml).toContain("not a new publisher release");
  expect(row.payload.severity).toBe("unknown");
});
