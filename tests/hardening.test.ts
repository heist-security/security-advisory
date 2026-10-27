import { describe, expect, it, vi, afterEach } from "vitest";
import Parser from "rss-parser";
import {
  parseFeedQuery,
  filterQuery,
  pageParams,
} from "../src/presentation/filters";
import { sourcePage } from "../src/adapters/sources/registry";
import {
  articleText,
  documentText,
  type Source,
} from "../src/adapters/sources/publisher";
import { validateEvidence, type Extraction } from "../src/domain/evidence";
import { rss } from "../src/presentation/rss";
import { itemFixture } from "./support/fixtures";
import { failureReason } from "../src/application/errors";
afterEach(() => vi.unstubAllGlobals());
const text =
  "Widget security fixes. Fixed in 2.3.4. Severity: High. This improves workflow performance.";
const extraction: Extraction = {
  security_relevant: true,
  kind: "patch",
  title: "Widget update",
  summary: "A security update.",
  evidence: "Widget security fixes.",
  products: [
    {
      name: { value: "Widget", evidence: "Widget security fixes." },
      affected_versions: [],
      fixed_versions: [{ value: "2.3.4", evidence: "Fixed in 2.3.4." }],
      prerequisites: [],
    },
  ],
  related_cves: [],
  severity: "unknown",
  severity_evidence: null,
};
describe("validated subscription filters", () => {
  it("normalizes technology and CVE without changing event identity", () => {
    expect(
      parseFeedQuery(
        new URLSearchParams(
          "technology=Node.js&cve=cve-2026-12345&type=patch&after=0",
        ),
      ),
    ).toMatchObject({
      technology: "node-js",
      cve: "CVE-2026-12345",
      type: ["patch"],
      after: 0,
    });
  });
  it("rejects ambiguous API parameters and unsafe cursors", () => {
    for (const q of [
      "type=patch&type=advisory",
      "after=-1",
      "after=",
      "after=9007199254740992",
      "limit=101",
      "after=1&before=2",
      "technology=!!!",
    ])
      expect(() => parseFeedQuery(new URLSearchParams(q))).toThrow();
  });
  it("canonicalizes type unions and keeps the kind alias compatible", () => {
    const query = parseFeedQuery(
      new URLSearchParams("type=patch,advisory,patch"),
    );
    expect(query.type).toEqual(["advisory", "patch"]);
    expect(filterQuery(query).get("type")).toBe("advisory,patch");
    expect(
      parseFeedQuery(new URLSearchParams("kind=patch,advisory")).type,
    ).toEqual(query.type);
    expect(
      parseFeedQuery(
        new URLSearchParams("type=patch,advisory&kind=advisory,patch"),
      ).type,
    ).toEqual(query.type);
    for (const value of [
      "type=patch,unknown",
      "type=patch,",
      "type=patch&type=advisory",
      "type=patch&kind=advisory",
      "type=" + Array(6).fill("patch").join(","),
    ])
      expect(() => parseFeedQuery(new URLSearchParams(value))).toThrow();
  });
  it("handles repeated browser parameters and bounds source pagination", () => {
    expect(pageParams({ q: ["ruby", "node"] }).get("q")).toBe("ruby");
    expect(sourcePage(new URLSearchParams()).rows).toHaveLength(3);
    expect(sourcePage(new URLSearchParams("catalog=vendor")).rows).toHaveLength(
      24,
    );
    expect(sourcePage(new URLSearchParams("page=-999")).page).toBe(1);
  });
});
describe("source and publication boundaries", () => {
  it("retains article header identity while removing site navigation", () => {
    expect(
      articleText(
        "<body><header>Site chrome</header><article><header><h1>Widget 2.3.4 security update</h1></header><p>Fixed.</p></article></body>",
      ),
    ).toBe("Widget 2.3.4 security update Fixed.");
  });
  it("rejects empty or whitespace-only fixed versions", () => {
    for (const value of ["", " "]) {
      const data = structuredClone(extraction);
      data.products[0].fixed_versions[0].value = value;
      expect(() => validateEvidence(data, text)).toThrow();
    }
  });
  it("requires labeled severity instead of the substring in workflow", () => {
    expect(() =>
      validateEvidence(
        {
          ...extraction,
          severity: "low",
          severity_evidence: "This improves workflow performance.",
        },
        text,
      ),
    ).toThrow();
    expect(
      validateEvidence(
        {
          ...extraction,
          severity: "high",
          severity_evidence: "Severity: High.",
        },
        text,
      ).severity,
    ).toBe("high");
  });
  it("checks the configured repository path after every redirect", async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: {
          location: "https://github.com/other/project/releases/tag/v1",
        },
      }),
    );
    vi.stubGlobal("fetch", fetch);
    await expect(
      documentText(
        {
          adapter: "article",
          feed_url: "https://github.com/trusted/project/releases.atom",
          allowed_origins: ["https://github.com"],
          item_url_prefix: "https://github.com/trusted/project/",
        } as Source,
        { link: "https://github.com/trusted/project/releases/tag/v1" },
      ),
    ).rejects.toThrow("source path");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("keeps HTML examples inert after an RSS reader decodes XML", async () => {
    const row = itemFixture({
      title: "Widget security update",
      summary: 'Run <script>alert("x")</script> & upgrade.',
    });
    const parsed = await new Parser().parseString(
      rss([row], "https://example.org"),
    );
    expect(parsed.items[0].content).not.toContain("<script");
    expect(parsed.items[0].content).toContain("&lt;script");
  });
  it("never persists provider secrets or arbitrary messages in failure categories", () => {
    expect(
      failureReason(
        new Error("secret API key sk-private should not be logged"),
      ),
    ).toBe("collection_or_processing_failed");
    expect(failureReason({ status: 429 })).toBe("provider_rate_limit");
  });
});

it("normalizes C++ and C# without collapsing them into the same subscription", () => {
  expect(
    parseFeedQuery(new URLSearchParams({ technology: "C++" })).technology,
  ).toBe("c-plus-plus");
  expect(
    parseFeedQuery(new URLSearchParams({ technology: "C#" })).technology,
  ).toBe("c-sharp");
});
