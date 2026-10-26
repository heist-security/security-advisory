import { afterEach, expect, it, vi } from "vitest";
import { GET as jsonFeed } from "../src/app/api/v1/events/route";
import { GET as rssFeed } from "../src/app/feed.xml/route";
import { parseEventQuery, filterQuery } from "../src/lib/filters";
import type { FeedEvent } from "../src/lib/events";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const primary: FeedEvent = {
  id: 42,
  advisory_id: "00000000-0000-0000-0000-000000000042",
  revision: 2,
  source_id: "core-osv",
  source_url: "https://osv.dev/vulnerability/GHSA-7x63-xv5r-3p2x",
  source_published_at: "2026-04-15T00:00:00Z",
  published_at: "2026-10-25T00:00:00Z",
  extraction_method: "llm",
  technologies: [],
  cve_ids: [],
  event_types: ["advisory"],
  payload: {
    security_relevant: true,
    kind: "advisory",
    title: "OAuth2 Proxy advisory",
    summary: "Primary source description",
    products: [],
    related_cves: [],
    severity: "unknown",
    severity_evidence: null,
    evidence: "osv:GHSA-7x63-xv5r-3p2x",
    structured: {
      provider: "osv",
      id: "GHSA-7x63-xv5r-3p2x",
      modified: "2026-10-25T00:00:00Z",
      aliases: [],
      references: [],
      affected: [],
    },
  },
};
const mirror: FeedEvent = {
  ...primary,
  id: 43,
  advisory_id: "00000000-0000-0000-0000-000000000043",
  source_url: "https://osv.dev/vulnerability/GO-2026-5236",
  payload: {
    ...primary.payload,
    summary: "A changed <source> & mitigation.",
    structured: { ...primary.payload.structured!, id: "GO-2026-5236" },
  },
};
const group = {
  id: 7,
  group_id: "osv:GHSA-7x63-xv5r-3p2x",
  revision: 3,
  published_at: primary.published_at,
  primary,
  changed: mirror,
  members: [primary, mirror],
  change: "updated",
  superseded_by: [],
};
function database(data: unknown = [group]) {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  vi.stubEnv("PUBLIC_BASE_URL", "https://feed.example.test");
  const fetch = vi.fn().mockImplementation(async () => Response.json(data));
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
it("exposes grouped snapshots with independent cursors and intact primary/member event IDs", async () => {
  const fetch = database();
  const result = await jsonFeed(
    new Request(
      "https://feed.example.test/api/v1/events?view=grouped&technology=Node.js&type=patch,advisory&limit=2&before=9",
    ),
  );
  expect(result.status).toBe(200);
  const body = await result.json();
  expect(body).toMatchObject({
    schema_version: "2",
    view: "grouped",
    next_after: 7,
    next_before: 7,
  });
  expect(body.data[0]).toMatchObject({
    id: 7,
    group: { primary_event_id: 42, revision: 3 },
  });
  expect(body.data[0].group.members.map((m: FeedEvent) => m.id)).toEqual([
    42, 43,
  ]);
  expect(
    body.data[0].group.members.every(
      (m: FeedEvent) => m.extraction_method === "structured",
    ),
  ).toBe(true);
  const [url, options] = fetch.mock.calls[0];
  expect(url.toString()).toContain("/rpc/query_advisory_current");
  expect(JSON.parse(options.body)).toEqual({
    filters: { technology: "node-js", type: "advisory,patch" },
    p_limit: 2,
    p_after: null,
    p_before: 9,
  });
});
it("requests the immutable group update stream for after cursors and preserves empty cursors", async () => {
  const fetch = database([]);
  const result = await jsonFeed(
    new Request("https://feed.example.test/api/v1/events?view=grouped&after=7"),
  );
  expect(await result.json()).toMatchObject({ data: [], next_after: 7 });
  expect(fetch.mock.calls[0][0].toString()).toContain(
    "/rpc/query_advisory_updates",
  );
});
it("uses group-update RSS GUIDs and includes scoped source information and escaped changed details", async () => {
  const fetch = database();
  const result = await rssFeed(
    new Request("https://feed.example.test/feed.xml?view=grouped"),
  );
  const xml = await result.text();
  expect(result.status).toBe(200);
  expect(xml).toContain("heist-group-update:7");
  expect(xml).not.toContain("heist-event:");
  expect(xml).toContain("GO-2026-5236");
  expect(xml).toContain("&amp;lt;source&amp;gt; &amp;amp; mitigation.");
  expect(xml).toContain("/feed.xml?view=grouped");
  expect(fetch.mock.calls[0][0].toString()).toContain(
    "/rpc/query_advisory_updates",
  );
});
it("preserves the legacy event endpoint and rejects malformed/repeated group options", async () => {
  const fetch = database([primary]);
  const response = await jsonFeed(
    new Request("https://feed.example.test/api/v1/events?after=40"),
  );
  expect(await response.json()).toMatchObject({
    schema_version: "1",
    view: "events",
    data: [{ id: 42 }],
  });
  expect(fetch.mock.calls[0][0].toString()).toContain("/events?");
  for (const query of [
    "view=invalid",
    "view=grouped&view=events",
    "group=arbitrary",
    "group=a&group=b",
  ])
    expect(() => parseEventQuery(new URLSearchParams(query))).toThrow();
  const params = new URLSearchParams(
    "view=events&group=osv:GHSA-7x63-xv5r-3p2x",
  );
  expect(filterQuery(parseEventQuery(params)).toString()).toBe(
    params.toString(),
  );
});
