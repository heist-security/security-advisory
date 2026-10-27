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

it.each([
  "",
  "<link>https://outside.example/update</link>",
  "<link>https://www.ruby-lang.org/about</link>",
])(
  "keeps valid notices when another entry has a rejected URL: %s",
  async (invalid) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          `<rss version="2.0"><channel><title>Ruby</title><item><title>Valid update</title><link>https://www.ruby-lang.org/en/news/test</link></item><item><title>Rejected update</title>${invalid}</item></channel></rss>`,
          {
            headers: {
              etag: '"new-feed"',
              "last-modified": "Mon, 26 Oct 2026 00:00:00 GMT",
            },
          },
        ),
      ),
    );
    const result = await sourceReader.discover({
      id: "ruby",
      definition: {
        ...vendorRegistry.find((s) => s.id === "ruby")!,
        adapter: "feed-content",
        item_url_prefix: "https://www.ruby-lang.org/en/news/",
      },
      lease_token: "lease",
      etag: '"old-feed"',
      last_modified: null,
    });
    expect(result.entries.map((entry) => entry.url)).toEqual([
      "https://www.ruby-lang.org/en/news/test",
    ]);
    expect(result).toMatchObject({
      rejected_entries: 1,
      etag: null,
      last_modified: null,
    });
  },
);
