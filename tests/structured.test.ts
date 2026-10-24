import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeRecord } from "../src/lib/structured/normalize";
import {
  cveChanges,
  discover,
  osvChanges,
  page,
  recordUrl,
  sourceUrl,
} from "../src/lib/structured/discover";
import {
  structuredDocument,
  readStructuredDocument,
} from "../src/lib/structured/pipeline";
import { parseRiskQuery, riskContext } from "../src/lib/structured/risk";
import { endpoints } from "../src/lib/structured/config";

const changed = "2026-10-24T10:00:00Z";
const osv = {
  id: "GHSA-aaaa-bbbb-cccc",
  modified: changed,
  published: "2026-10-23T10:00:00Z",
  aliases: ["CVE-2026-12345", "CVE-2026-12345"],
  summary: "Widget update",
  details: "A widget vulnerability.",
  affected: [
    {
      package: { name: "widget", ecosystem: "npm", purl: "pkg:npm/widget" },
      ranges: [
        {
          type: "SEMVER",
          events: [{ introduced: "1.0.0" }, { fixed: "1.2.3" }],
        },
      ],
    },
    {
      package: { name: "widget", ecosystem: "Debian:12" },
      versions: ["1.0.0-1+deb12u2"],
      ranges: [
        {
          type: "ECOSYSTEM",
          events: [{ introduced: "0" }, { fixed: "1.0.0-1+deb12u3" }],
        },
      ],
    },
  ],
  severity: [
    { type: "CVSS_V3", score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H" },
  ],
  references: [
    { url: "https://example.org/advisory" },
    { url: "javascript:alert(1)" },
  ],
};
const cve = {
  dataType: "CVE_RECORD",
  cveMetadata: {
    cveId: "CVE-2026-12345",
    state: "PUBLISHED",
    dateUpdated: changed,
  },
  containers: {
    cna: {
      title: "Widget issue",
      descriptions: [{ lang: "en", value: "Widget has an issue." }],
      affected: [
        {
          vendor: "Example",
          product: "Widget",
          defaultStatus: "unaffected",
          versions: [
            {
              version: "1",
              lessThan: "2",
              versionType: "custom",
              status: "affected",
              changes: [{ at: "1.5", status: "unaffected" }],
            },
          ],
        },
      ],
      metrics: [{ cvssV3_1: { baseSeverity: "HIGH", baseScore: 8.1 } }],
    },
  },
};
const kev = {
  cveID: "CVE-2026-12345",
  vendorProject: "Example",
  product: "Widget",
  vulnerabilityName: "Widget issue",
  shortDescription: "An issue.",
  dateAdded: "2026-10-23",
  requiredAction: "Apply vendor updates.",
  dueDate: "2026-11-01",
  knownRansomwareCampaignUse: "Unknown",
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const respond = (data: unknown) =>
  new Response(JSON.stringify(data), {
    headers: { "content-type": "application/json" },
  });

describe("native advisory semantics", () => {
  it("preserves package ecosystems, backports and original ranges, without interpreting a CVSS vector as a label", () => {
    const p = normalizeRecord("core-osv", osv).payload;
    expect(p.structured.affected).toEqual(osv.affected);
    expect(p.products[0].fixed_versions[0].value).toBe("1.2.3");
    expect(p.products[1].fixed_versions[0].value).toBe("1.0.0-1+deb12u3");
    expect(p.related_cves).toHaveLength(1);
    expect(p.severity).toBe("unknown");
    expect(p.structured.references).toEqual(["https://example.org/advisory"]);
  });
  it("does not invent a fixed release from CVE unaffected versions or upper bounds", () => {
    const p = normalizeRecord("core-cve", cve).payload;
    expect(p.structured.affected).toEqual(cve.containers.cna.affected);
    expect(p.products[0].fixed_versions).toEqual([]);
    expect(p.severity).toBe("high");
  });
  it("retains explicit OSV withdrawals and CVE rejections as relevant corrections", () => {
    expect(
      normalizeRecord("core-osv", { ...osv, withdrawn: changed }).payload.kind,
    ).toBe("withdrawal");
    const rejected = structuredClone(cve);
    rejected.cveMetadata.state = "REJECTED";
    expect(normalizeRecord("core-cve", rejected).payload).toMatchObject({
      security_relevant: true,
      kind: "withdrawal",
    });
  });
  it("separates confirmed exploitation from severity and does not infer safety from KEV removal", () => {
    const p = normalizeRecord("core-kev", kev).payload;
    expect(p.structured.exploitation).toMatchObject({ known_exploited: true });
    expect(p.severity).toBe("unknown");
    const removed = normalizeRecord("core-kev", {
      cveID: kev.cveID,
      removed: true,
      removedAt: changed,
    }).payload;
    expect(removed.kind).toBe("withdrawal");
    expect(removed.structured.exploitation).not.toHaveProperty(
      "known_exploited",
      false,
    );
  });
  it("fails on oversized native version data rather than silently dropping affected products", () => {
    expect(() =>
      normalizeRecord("core-osv", {
        ...osv,
        affected: Array.from({ length: 1000 }, () => osv.affected[0]),
      }),
    ).toThrow(/byte limit/);
  });
  it("does not label Git commit hashes as fixed package versions", () => {
    const r = structuredClone(osv);
    r.affected[0].ranges[0].type = "GIT";
    expect(
      normalizeRecord("core-osv", r).payload.products[0].fixed_versions,
    ).toEqual([]);
  });
});
describe("resumable discovery", () => {
  const entry = (id: string, modified = changed) => ({
    link: sourceUrl("core-osv", id),
    isoDate: modified,
    structured: { id, modified },
  });
  it("paginates equal timestamps and duplicate ecosystem entries without advancing past unstaged work", () => {
    const rows = [
      entry("OSV-C"),
      entry("OSV-A"),
      entry("OSV-B"),
      entry("OSV-A"),
    ];
    const first = page(rows, { since: "2026-10-24T09:00:00Z" }, changed, 2);
    expect(first.items.map((r) => r.structured.id)).toEqual(["OSV-A", "OSV-B"]);
    expect(first.more).toBe(true);
    expect(first.state.since).toBe("2026-10-24T09:00:00Z");
    const second = page(rows, first.state, changed, 2);
    expect(second.items.map((r) => r.structured.id)).toEqual(["OSV-C"]);
    expect(second.state).toEqual({ since: changed });
  });
  it("cancels an OSV index after the checkpoint and handles split lines", async () => {
    const cancel = vi.fn();
    let n = 0;
    const chunks = [
      "2026-10-24T10:00:00Z,npm/GHSA-aaa",
      "a-bbbb-cccc\n2026-10-22T00:00:00Z,npm/OLD\n",
      "not valid\n",
    ];
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            new ReadableStream({
              pull(controller) {
                controller.enqueue(new TextEncoder().encode(chunks[n++]));
              },
              cancel,
            }),
          ),
      ),
    );
    expect(
      (await osvChanges("2026-10-24T09:00:00Z")).map((r) => r.structured.id),
    ).toEqual([osv.id]);
    expect(cancel).toHaveBeenCalled();
  });
  it("uses CVE delivery timestamps even when the record date was backdated", () => {
    const logs = [
      { fetchTime: "2026-10-24T08:00:00Z", new: [], updated: [], error: [] },
      {
        fetchTime: changed,
        new: [],
        updated: [{ cveId: kev.cveID, dateUpdated: "2020-01-01T00:00:00Z" }],
        error: [],
      },
    ];
    expect(
      cveChanges(logs, "2026-10-24T09:00:00Z").items[0].structured.modified,
    ).toBe("2026-10-24T10:00:00.000Z");
    expect(() => cveChanges(logs, "2026-09-01T00:00:00Z")).toThrow(/backfill/);
  });
  it("derives CVE record paths from validated IDs", () => {
    expect(recordUrl("core-cve", "CVE-2026-12345")).toContain(
      "/2026/12xxx/CVE-2026-12345.json",
    );
    expect(recordUrl("core-cve", "CVE-2026-0001")).toContain("/2026/0xxx/");
    expect(() => recordUrl("core-osv", "../../metadata")).toThrow();
  });
  it("pages an immutable CVE bootstrap before handing off to the live delta log", async () => {
    const ref = "a".repeat(40);
    const snapshot = [
      { fetchTime: "2026-09-23T00:00:00Z", new: [], updated: [] },
      {
        fetchTime: "2026-09-24T01:00:00Z",
        new: [{ cveId: "CVE-2026-11111", dateUpdated: "2020-01-01T00:00:00Z" }],
        updated: [],
      },
      {
        fetchTime: "2026-10-23T23:00:00Z",
        new: [{ cveId: "CVE-2026-22222", dateUpdated: changed }],
        updated: [],
      },
    ];
    const live = [
      { fetchTime: "2026-09-25T00:00:00Z", new: [], updated: [] },
      {
        fetchTime: changed,
        new: [{ cveId: "CVE-2026-33333", dateUpdated: changed }],
        updated: [],
      },
    ];
    const fetch = vi.fn(async (url: string) =>
      respond(url.includes(`/${ref}/`) ? snapshot : live),
    );
    vi.stubGlobal("fetch", fetch);
    const first = await discover(
      "core-cve",
      {
        since: "2026-09-24T00:00:00Z",
        cve_bootstrap_ref: ref,
      },
      1,
    );
    expect(first.items.map((r) => r.structured.id)).toEqual(["CVE-2026-11111"]);
    expect(first.state).toMatchObject({
      since: "2026-09-24T00:00:00Z",
      until: "2026-10-23T23:00:00.000Z",
      cve_bootstrap_ref: ref,
    });
    const second = await discover("core-cve", first.state, 1);
    expect(second.items.map((r) => r.structured.id)).toEqual([
      "CVE-2026-22222",
    ]);
    expect(second.state).toEqual({ since: "2026-10-23T23:00:00.000Z" });
    const third = await discover("core-cve", second.state, 1);
    expect(third.items.map((r) => r.structured.id)).toEqual(["CVE-2026-33333"]);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      `https://raw.githubusercontent.com/CVEProject/cvelistV5/${ref}/cves/deltaLog.json`,
      `https://raw.githubusercontent.com/CVEProject/cvelistV5/${ref}/cves/deltaLog.json`,
      endpoints.cve,
    ]);
  });
  it("rejects unpinned CVE bootstrap refs and never skips an unavailable archive", async () => {
    const fetch = vi.fn(
      async () => new Response("Unavailable", { status: 503 }),
    );
    vi.stubGlobal("fetch", fetch);
    for (const ref of ["main", "../../another/repo", "a".repeat(39)]) {
      await expect(
        discover("core-cve", {
          since: "2026-09-24T00:00:00Z",
          cve_bootstrap_ref: ref,
        }),
      ).rejects.toThrow();
    }
    expect(fetch).not.toHaveBeenCalled();
    const state = {
      since: "2026-09-24T00:00:00Z",
      cve_bootstrap_ref: "a".repeat(40),
    };
    await expect(discover("core-cve", state)).rejects.toThrow(/503/);
    expect(state).toEqual({
      since: "2026-09-24T00:00:00Z",
      cve_bootstrap_ref: "a".repeat(40),
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("emits a removal only after comparing complete KEV snapshots", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        respond({ dateReleased: changed, vulnerabilities: [kev] }),
      ),
    );
    const result = await discover("core-kev", {
      since: changed,
      kev_ids: [kev.cveID, "CVE-2026-99999"],
    });
    expect(result.items).toHaveLength(2);
    expect(result.items[1].structured.record).toMatchObject({
      removed: true,
      cveID: "CVE-2026-99999",
    });
    expect(result.state.kev_ids).toEqual([kev.cveID]);
  });
});
it("collects deterministically, checks record identity, and refuses an envelope on a vendor source", async () => {
  const fetch = vi.fn(async () => respond(osv));
  vi.stubGlobal("fetch", fetch);
  const item = {
    link: sourceUrl("core-osv", osv.id),
    structured: { id: osv.id, modified: changed },
  };
  const doc = await structuredDocument("core-osv", item);
  expect(
    readStructuredDocument({
      source_id: "core-osv",
      source_url: item.link,
      body: doc.body,
    }).payload.structured.id,
  ).toBe(osv.id);
  expect(() =>
    readStructuredDocument({
      source_id: "vendor",
      source_url: item.link,
      body: doc.body,
    }),
  ).toThrow(/identity/);
  fetch.mockResolvedValue(respond({ ...osv, id: "OSV-WRONG" }));
  await expect(structuredDocument("core-osv", item)).rejects.toThrow(
    /identity/,
  );
});
describe("risk enrichment", () => {
  it("bounds requests and rejects arbitrary URLs or bulk NVD requests", () => {
    expect(() =>
      parseRiskQuery(new URLSearchParams("cve=https://localhost")),
    ).toThrow();
    expect(() =>
      parseRiskQuery(
        new URLSearchParams("cve=CVE-2026-12345,CVE-2026-12346&nvd=1"),
      ),
    ).toThrow();
    expect(parseRiskQuery(new URLSearchParams("cve=cve-2026-12345"))).toEqual({
      ids: [kev.cveID],
      nvd: false,
    });
  });
  it("preserves unavailable vs missing scores and does not block KEV when EPSS is down", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === endpoints.kev
          ? respond({ vulnerabilities: [kev] })
          : new Response("unavailable", { status: 503 }),
      ),
    );
    const result = await riskContext([kev.cveID]);
    expect(result.availability).toEqual({
      kev: "available",
      epss: "unavailable",
      nvd: "not_requested",
    });
    expect(result.data[0].epss).toBeNull();
    expect(result.data[0].kev).toEqual(kev);
  });
  it("retains EPSS date and probability without translating them to severity", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url === endpoints.kev
          ? respond({ vulnerabilities: [] })
          : respond({
              status: "OK",
              total: 1,
              data: [
                {
                  cve: kev.cveID,
                  epss: "0.42",
                  percentile: "0.98",
                  date: "2026-10-24",
                },
              ],
            }),
      ),
    );
    const result = await riskContext([kev.cveID]);
    expect(result.data[0].epss).toEqual({
      cve: kev.cveID,
      epss: 0.42,
      percentile: 0.98,
      date: "2026-10-24",
    });
    expect(result.data[0].kev).toBeNull();
  });
});

it("supports distribution advisory IDs containing colons and stable ASCII paging", () => {
  expect(recordUrl("core-osv", "openSUSE-SU-2026:22153-1")).toContain(
    "2026%3A22153",
  );
  const rows = ["OSV-a", "OSV-Z", "OSV-z", "OSV-A"].map((id) => ({
    link: sourceUrl("core-osv", id),
    isoDate: changed,
    structured: { id, modified: changed },
  }));
  const first = page(rows, { since: changed }, changed, 2);
  const second = page(rows, first.state, changed, 2);
  expect([...first.items, ...second.items].map((r) => r.structured.id)).toEqual(
    ["OSV-A", "OSV-Z", "OSV-a", "OSV-z"],
  );
});
