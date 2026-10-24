import { describe, expect, it, vi, afterEach } from "vitest";
import { validateEvidence, type Extraction } from "../src/lib/schema";
import { allowedUrl, fetchText } from "../src/lib/http";
import { authorized } from "../src/lib/cron";
import { rss, type FeedEvent } from "../src/lib/events";
import { articleText } from "../src/lib/ingest";

const text =
  "Ruby security fixes. Fixed in 4.0.9. Applications accepting attacker-controlled regular expressions are affected.";
const extraction: Extraction = {
  security_relevant: true,
  kind: "patch",
  title: "Ruby security fixes",
  summary: "Ruby published a security fix.",
  evidence: "Ruby security fixes.",
  products: [
    {
      name: { value: "Ruby", evidence: "Ruby security fixes." },
      affected_versions: [],
      fixed_versions: [{ value: "4.0.9", evidence: "Fixed in 4.0.9." }],
      prerequisites: [
        {
          value: "attacker-controlled regular expressions",
          evidence:
            "Applications accepting attacker-controlled regular expressions are affected.",
        },
      ],
    },
  ],
  related_cves: [],
  severity: "unknown",
  severity_evidence: null,
};
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
describe("source-backed extraction", () => {
  it("accepts a no-CVE Ruby-style patch with prerequisites", () => {
    expect(validateEvidence(extraction, text).related_cves).toEqual([]);
  });
  it("rejects a hallucinated fixed version even with a genuine quote", () => {
    const copy = structuredClone(extraction);
    copy.products[0].fixed_versions[0].value = "9.9.9";
    expect(() => validateEvidence(copy, text)).toThrow("Fact absent");
  });
  it("rejects fabricated evidence and severity", () => {
    expect(() =>
      validateEvidence({ ...extraction, evidence: "Made up" }, text),
    ).toThrow();
    expect(() =>
      validateEvidence(
        { ...extraction, severity: "critical", severity_evidence: text },
        text,
      ),
    ).toThrow();
  });
  it("rejects malformed or unsupported CVE claims", () => {
    expect(() =>
      validateEvidence(
        {
          ...extraction,
          related_cves: [{ value: "CVE-2026-12345", evidence: text }],
        },
        text,
      ),
    ).toThrow();
  });
  it("does not fabricate data for an irrelevant release", () => {
    expect(
      validateEvidence(
        { ...extraction, security_relevant: false, products: [], evidence: "" },
        "New logo",
      ).security_relevant,
    ).toBe(false);
  });
});
describe("collector boundaries", () => {
  it("rejects off-source URLs, credentials, and insecure transport", () => {
    for (const url of [
      "http://ruby-lang.org/a",
      "https://evil.example/a",
      "https://user@www.ruby-lang.org/a",
      "https://127.0.0.1/a",
    ])
      expect(() => allowedUrl(url, ["https://www.ruby-lang.org"])).toThrow();
  });
  it("rejects a redirect outside the source allowlist", async () => {
    const mocked = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/" },
        }),
      );
    vi.stubGlobal("fetch", mocked);
    await expect(
      fetchText("https://www.ruby-lang.org/a", ["https://www.ruby-lang.org"]),
    ).rejects.toThrow();
    expect(mocked).toHaveBeenCalledTimes(1);
  });
  it("removes navigation and executable content", () => {
    expect(
      articleText(
        "<nav>Ignore this</nav><article>Ruby <script>bad()</script>security fix</article>",
      ),
    ).toBe("Ruby security fix");
  });
  it("refuses a source that would otherwise be silently truncated", () => {
    expect(() =>
      articleText(`<article>${"a".repeat(50001)}</article>`),
    ).toThrow("oversized");
  });
});
describe("public RSS and private jobs", () => {
  it("escapes XML and uses event identity rather than CVE identity", () => {
    const row: FeedEvent = {
      id: 12,
      advisory_id: "a",
      revision: 2,
      source_id: "ruby",
      source_url: "https://example.com/?a=1&b=2",
      source_published_at: null,
      published_at: "2026-10-23T00:00:00Z",
      extraction_method: "llm",
      technologies: [],
      cve_ids: [],
      event_types: [],
      payload: { ...extraction, title: "Fix <script> & upgrade" },
    };
    const output = rss([row], "https://feed.heist.security");
    expect(output).toContain("Fix &lt;script&gt; &amp; upgrade");
    expect(output).toContain("heist-event:12");
    expect(output).toContain("Revision 2");
  });
  it("fails closed without a secret and checks exact bearer auth", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(authorized(new Request("https://test/"))).toBe(false);
    const secret = "a".repeat(32);
    vi.stubEnv("CRON_SECRET", secret);
    expect(
      authorized(
        new Request("https://test/", {
          headers: { authorization: `Bearer ${secret}` },
        }),
      ),
    ).toBe(true);
    expect(
      authorized(
        new Request("https://test/", {
          headers: { authorization: `Bearer ${"b".repeat(32)}` },
        }),
      ),
    ).toBe(false);
  });
});
