import { beforeEach, afterEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), fetchResource: vi.fn(), documentText: vi.fn(), extract: vi.fn() }));
vi.mock("../src/lib/db", () => ({ db: () => ({ rpc: mocks.rpc }) }));
vi.mock("../src/lib/http", () => ({ fetchResource: mocks.fetchResource }));
vi.mock("../src/lib/extract", () => ({ extract: mocks.extract }));
vi.mock("../src/lib/feed", async importOriginal => ({ ...await importOriginal<object>(), documentText: mocks.documentText }));
import { poll, processJobs } from "../src/lib/ingest";
import { NoReleaseNotesError } from "../src/lib/feed";
const source = { id: "sample", name: "Sample", category: "languages-runtimes", channel: "release-notes", adapter: "feed-content", feed_url: "https://example.org/feed.xml", homepage: "https://example.org", discovery_url: "https://example.org", allowed_origins: ["https://example.org"], item_url_prefix: null, poll_interval_minutes: 120, max_feed_bytes: 2000000, rationale: "Upstream release notes for a security-sensitive component.", limitations: "Only information in the current upstream release notes is covered.", lease_token: "token", etag: "old", last_modified: null };
beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv("POLL_CONCURRENCY", "2"); vi.stubEnv("POLL_BATCH_SIZE", "4");
  mocks.fetchResource.mockResolvedValue({ text: '<rss version="2.0"><channel><title>Releases</title><item><title>Patch</title><link>https://example.org/patch</link></item></channel></rss>', status: 200, etag: "new", last_modified: null });
  mocks.documentText.mockResolvedValue({ url: "https://example.org/patch", body: "A security patch release with source-backed version details." });
});
afterEach(() => vi.unstubAllEnvs());
it("collects multiple due streams in a bounded invocation without losing completions", async () => {
  const queue = [{ ...source, id: "first" }, { ...source, id: "second" }];
  mocks.rpc.mockImplementation(async (method: string) => method === "claim_source" ? { data: queue.length ? [queue.shift()] : [], error: null } : { data: true, error: null });
  const result = await poll();
  expect(result.sources).toBe(2); expect(result.documents_added).toBe(2);
  expect(mocks.rpc.mock.calls.filter(([method]) => method === "complete_source")).toHaveLength(2);
});
it("does not suppress article rechecks when a feed previously had an ETag", async () => {
  let claimed = false;
  mocks.rpc.mockImplementation(async (method: string) => {
    if (method === "claim_source") { const data = claimed ? [] : [{ ...source, adapter: "article" }]; claimed = true; return { data, error: null }; }
    return { data: true, error: null };
  });
  await poll();
  expect(mocks.fetchResource.mock.calls[0][2].etag).toBeUndefined();
});
it("does not cache a partially failed poll and thereby hide retryable articles", async () => {
  let claimed = false;
  mocks.rpc.mockImplementation(async (method: string) => {
    if (method === "claim_source") { const data = claimed ? [] : [source]; claimed = true; return { data, error: null }; }
    return { data: true, error: null };
  });
  mocks.documentText.mockRejectedValue(new Error("Article unavailable"));
  expect((await poll()).failures).toBe(1);
  const complete = mocks.rpc.mock.calls.find(([method]) => method === "complete_source")![1];
  expect(complete.succeeded).toBe(false); expect(complete.new_etag).toBeNull();
});
it("leaves queued work untouched when extraction credentials are absent", async () => {
  vi.stubEnv("OPENAI_API_KEY", ""); vi.stubEnv("OPENAI_MODEL", "");
  await expect(processJobs()).rejects.toThrow("not configured"); expect(mocks.rpc).not.toHaveBeenCalled();
});
it("reports a formerly useful stream that now contains only synthesized tags", async () => {
  let claimed = false;
  mocks.rpc.mockImplementation(async (method: string) => {
    if (method === "claim_source") { const data = claimed ? [] : [source]; claimed = true; return { data, error: null }; }
    return { data: true, error: null };
  });
  mocks.documentText.mockRejectedValue(new NoReleaseNotesError("No release notes"));
  const result = await poll();
  expect(result.skipped).toBe(1); expect(result.failures).toBe(1);
  expect(mocks.rpc.mock.calls.some(([method]) => method === "enqueue_document")).toBe(false);
  const complete = mocks.rpc.mock.calls.find(([method]) => method === "complete_source")![1];
  expect(complete.succeeded).toBe(false); expect(complete.message).toContain("no substantive release notes");
});
