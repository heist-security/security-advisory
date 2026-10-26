import { afterEach, expect, it, vi } from "vitest";
import { sourceReader } from "../src/adapters/sources/reader";
import { vendorRegistry } from "../src/adapters/sources/registry";
afterEach(() => vi.unstubAllGlobals());
it("revisits article feeds even with unchanged validators, so edited articles can be recollected", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(
        '<rss version="2.0"><channel><title>Ruby</title><item><title>Ruby update</title><link>https://www.ruby-lang.org/en/news/test</link><description>Security update</description></item></channel></rss>',
      ),
    );
  vi.stubGlobal("fetch", fetcher);
  const definition = {
    ...vendorRegistry.find((s) => s.id === "ruby")!,
    adapter: "article",
  };
  const result = await sourceReader.discover({
    id: "ruby",
    definition,
    checkpoint: null,
    lease_token: "test",
    etag: '"cached"',
    last_modified: "yesterday",
  });
  expect(result.entries).toHaveLength(1);
  const headers = new Headers(fetcher.mock.calls[0][1].headers);
  expect(headers.has("if-none-match")).toBe(false);
  expect(headers.has("if-modified-since")).toBe(false);
});
