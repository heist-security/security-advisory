import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
  fetchResource: vi.fn(),
  documentText: vi.fn(),
  extract: vi.fn(),
}));
vi.mock("../src/lib/db", () => ({ db: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/http", async (original) => ({
  ...(await original<object>()),
  fetchResource: mocks.fetchResource,
}));
vi.mock("../src/lib/extract", () => ({ extract: mocks.extract }));
vi.mock("../src/lib/feed", async (original) => ({
  ...(await original<object>()),
  documentText: mocks.documentText,
}));
import { poll, collect, processJobs } from "../src/lib/ingest";
import { NoReleaseNotesError } from "../src/lib/feed";
const source = {
  id: "sample",
  name: "Sample",
  category: "languages-runtimes",
  channel: "release-notes",
  adapter: "feed-content",
  feed_url: "https://example.org/feed.xml",
  homepage: "https://example.org",
  discovery_url: "https://example.org",
  allowed_origins: ["https://example.org"],
  item_url_prefix: null,
  poll_interval_minutes: 120,
  max_feed_bytes: 2000000,
  rationale: "Upstream release notes for a security-sensitive component.",
  limitations:
    "Only information in the current upstream release notes is covered.",
  lease_token: "token",
  etag: "old",
  last_modified: null,
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("POLL_CONCURRENCY", "1");
  vi.stubEnv("POLL_BATCH_SIZE", "1");
  vi.stubEnv("COLLECT_CONCURRENCY", "1");
  vi.stubEnv("COLLECT_BATCH_SIZE", "1");
  mocks.fetchResource.mockResolvedValue({
    text: '<rss version="2.0"><channel><title>Releases</title><item><title>Patch</title><link>https://example.org/patch</link></item></channel></rss>',
    status: 200,
    etag: "new",
    last_modified: null,
  });
  mocks.documentText.mockResolvedValue({
    url: "https://example.org/patch",
    body: "A security patch release with source-backed version details.",
  });
  mocks.rpc.mockImplementation(async (method) =>
    method === "claim_source"
      ? { data: [source], error: null }
      : { data: true, error: null },
  );
});
afterEach(() => vi.unstubAllEnvs());
it("persists all 601 entries, including those beyond the former 30-entry cap", async () => {
  const items = Array.from(
    { length: 601 },
    (_, i) =>
      "<item><title>Patch</title><link>https://example.org/" +
      i +
      "</link></item>",
  ).join("");
  mocks.fetchResource.mockResolvedValue({
    text:
      '<rss version="2.0"><channel><title>Releases</title>' +
      items +
      "</channel></rss>",
    status: 200,
    etag: "new",
  });
  expect((await poll()).entries_staged).toBe(601);
  const batches = mocks.rpc.mock.calls.filter(
    ([method]) => method === "stage_feed_entries",
  );
  expect(batches.map(([, args]) => args.p_entries.length)).toEqual([500, 101]);
  expect(batches[1][1].p_entries.at(-1).url).toBe("https://example.org/600");
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("does not suppress article rechecks with inline conditional caching", async () => {
  mocks.rpc.mockImplementation(async (method) =>
    method === "claim_source"
      ? { data: [{ ...source, adapter: "article" }], error: null }
      : { data: true, error: null },
  );
  await poll();
  expect(mocks.fetchResource.mock.calls[0][2].etag).toBeUndefined();
});
it("does not commit validators if durable staging fails", async () => {
  mocks.rpc.mockImplementation(async (method) =>
    method === "claim_source"
      ? { data: [source], error: null }
      : method === "stage_feed_entries"
        ? { error: new Error("database unavailable") }
        : { data: true, error: null },
  );
  expect((await poll()).failures).toBe(1);
  const complete = mocks.rpc.mock.calls.find(
    ([method]) => method === "complete_source",
  )![1];
  expect(complete.succeeded).toBe(false);
  expect(complete.new_etag).toBeNull();
});
it("collects a queued document and completes it under its lease", async () => {
  mocks.rpc.mockImplementation(async (method) =>
    method === "claim_feed_entry"
      ? {
          data: [
            {
              source,
              entry: {
                id: 41,
                lease_token: "entry-token",
                item: {},
                feed_title: "Releases",
              },
            },
          ],
        }
      : { data: true },
  );
  expect((await collect()).added).toBe(1);
  expect(mocks.rpc).toHaveBeenCalledWith(
    "complete_feed_entry",
    expect.objectContaining({
      p_id: 41,
      p_token: "entry-token",
      p_skipped: false,
    }),
  );
});
it("marks tag-only entries complete without invoking extraction", async () => {
  mocks.rpc.mockImplementation(async (method) =>
    method === "claim_feed_entry"
      ? { data: [{ source, entry: { id: 1, lease_token: "token", item: {} } }] }
      : { data: false },
  );
  mocks.documentText.mockRejectedValue(new NoReleaseNotesError("No notes"));
  expect((await collect()).skipped).toBe(1);
  expect(mocks.extract).not.toHaveBeenCalled();
});
it("leaves the extraction queue untouched without configuration", async () => {
  vi.stubEnv("OPENAI_API_KEY", "");
  vi.stubEnv("OPENAI_MODEL", "");
  await expect(processJobs()).rejects.toThrow("not configured");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
