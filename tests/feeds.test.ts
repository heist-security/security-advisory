import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it, expect, vi, afterEach } from "vitest";
import {
  articleText,
  inlineText,
  itemUrl,
  parseFeed,
  sourceSchema,
} from "../src/lib/feed";
import { fetchResource } from "../src/lib/http";

afterEach(() => vi.unstubAllGlobals());
describe("feed adapters", () => {
  it("uses complete Atom release bodies without fetching a GitHub page", async () => {
    const feed = await parseFeed(
      '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Releases</title><id>urn:test</id><updated>2026-10-23T00:00:00Z</updated><entry><title>Example 1.2.3</title><id>urn:one</id><link href="https://github.com/org/project/releases/tag/v1.2.3"/><content type="html">&lt;p&gt;Security fix: upgrade to 1.2.3 to prevent a path traversal vulnerability in archive extraction.&lt;/p&gt;</content></entry></feed>',
    );
    expect(inlineText(feed.items[0], feed.title)).toContain("upgrade to 1.2.3");
    expect(
      inlineText(feed.items[0], "Release notes from example-project"),
    ).toContain("Release notes from example-project");
  });
  it("does not count synthesized version tags as release notes", () => {
    expect(() => inlineText({ title: "1.2.3", content: "Tag 1.2.3" })).toThrow(
      "substantive",
    );
  });
  it("resolves publisher-relative links and upgrades only allowlisted HTTP hosts", () => {
    const source = {
      feed_url: "https://example.org/releases/feed.xml",
      allowed_origins: ["https://example.org"],
      item_url_prefix: null,
    };
    expect(itemUrl(source, { link: "../security/123#fix" })).toBe(
      "https://example.org/security/123#fix",
    );
    expect(itemUrl(source, { link: "http://example.org/advisory" })).toBe(
      "https://example.org/advisory",
    );
    expect(() =>
      itemUrl(source, { link: "http://evil.example/advisory" }),
    ).toThrow();
  });
  it("keeps release feeds inside their reviewed repository path", () => {
    const source = {
      feed_url: "https://github.com/org/project/releases.atom",
      allowed_origins: ["https://github.com"],
      item_url_prefix: "https://github.com/org/project/releases/",
    };
    expect(() =>
      itemUrl(source, {
        link: "https://github.com/other/project/releases/tag/v1",
      }),
    ).toThrow("outside source path");
  });
  it("rejects challenges and HTML masquerading as a feed", async () => {
    expect(() =>
      articleText("<title>Site Unavailable</title><main>Try later</main>"),
    ).toThrow("unavailable");
    await expect(
      parseFeed("<!DOCTYPE html><html>Bot challenge</html>"),
    ).rejects.toThrow("HTML");
  });
  it("rejects XML entity declarations without rejecting quoted document examples", async () => {
    await expect(
      parseFeed(
        '<!DOCTYPE feed [<!ENTITY file SYSTEM "file:///etc/passwd">]><feed/>',
      ),
    ).rejects.toThrow("XML declarations");
    const feed = await parseFeed(
      '<rss version="2.0"><channel><title>Example</title><item><title>Security fix</title><description><![CDATA[An example payload contains <!DOCTYPE html> text.]]></description></item></channel></rss>',
    );
    expect(feed.items).toHaveLength(1);
  });
  it("honors conditional requests without trying to read a 304 body", async () => {
    const mocked = vi
      .fn()
      .mockResolvedValue(
        new Response(null, { status: 304, headers: { ETag: '"abc"' } }),
      );
    vi.stubGlobal("fetch", mocked);
    const response = await fetchResource(
      "https://example.org/feed.xml",
      ["https://example.org"],
      { etag: '"abc"' },
    );
    expect(response.text).toBeNull();
    expect(response.status).toBe(304);
    expect(mocked.mock.calls[0][1].headers["If-None-Match"]).toBe('"abc"');
  });
  it("does not hang a worker if an oversized source stalls stream cancellation", async () => {
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(new Uint8Array(100));
      },
      cancel() {
        return new Promise(() => {});
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(body)));
    await expect(
      fetchResource("https://example.org/feed", ["https://example.org"], {
        max_bytes: 50,
      }),
    ).rejects.toThrow("byte limit");
  });
});
describe("audited registry", () => {
  const raw = readFileSync(
    new URL("../sources/registry.json", import.meta.url),
    "utf8",
  );
  const registry = JSON.parse(raw);
  it("contains hundreds of distinct, usable, reviewed streams", () => {
    expect(registry.length).toBeGreaterThanOrEqual(300);
    expect(new Set(registry.map((s: { id: string }) => s.id)).size).toBe(
      registry.length,
    );
    expect(
      new Set(registry.map((s: { feed_url: string }) => s.feed_url)).size,
    ).toBe(registry.length);
    for (const source of registry) {
      const config = sourceSchema.parse(source);
      expect(source.verification.status).toBe("verified");
      expect(source.verification.usable_items).toBeGreaterThan(0);
      expect(config.exclude_reason).toBeUndefined();
      expect(source.verification.config_sha256).toBe(
        createHash("sha256").update(JSON.stringify(config)).digest("hex"),
      );
    }
  });
  it("seeds the exact checked registry rather than a hand-maintained second list", () => {
    const migration = readFileSync(
      new URL(
        "../supabase/migrations/202610230003_verified_sources.sql",
        import.meta.url,
      ),
      "utf8",
    );
    expect(migration).toContain(
      `Registry SHA-256: ${createHash("sha256").update(raw).digest("hex")}`,
    );
    expect(JSON.parse(migration.split("$registry$")[1])).toEqual(registry);
  });
});
