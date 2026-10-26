import type { Source } from "../publisher";

export const structuredIds = ["core-osv", "core-cve", "core-kev"] as const;
export type StructuredId = (typeof structuredIds)[number];
export function isStructured(id: string): id is StructuredId {
  return (structuredIds as readonly string[]).includes(id);
}
export const endpoints = {
  osv: "https://storage.googleapis.com/osv-vulnerabilities/modified_id.csv",
  cve: "https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/deltaLog.json",
  kev: "https://raw.githubusercontent.com/cisagov/kev-data/main/known_exploited_vulnerabilities.json",
  epss: "https://api.first.org/data/v1/epss",
  nvd: "https://services.nvd.nist.gov/rest/json/cves/2.0",
};
const common = {
  category: "vulnerability-databases",
  channel: "security-advisories" as const,
  // Existing schema: inline queued data. Dispatch is by the reserved, reviewed source ID.
  adapter: "feed-content" as const,
  item_url_prefix: null,
  poll_interval_minutes: 15,
  max_feed_bytes: 10_000_000,
};
export const structuredSources: Source[] = [
  {
    ...common,
    id: "core-osv",
    name: "OSV",
    feed_url: endpoints.osv,
    homepage: "https://osv.dev",
    discovery_url: "https://google.github.io/osv.dev/data/",
    allowed_origins: [
      "https://storage.googleapis.com",
      "https://api.osv.dev",
      "https://osv.dev",
    ],
    rationale:
      "Structured package advisories aggregated from ecosystem databases, including GitHub Advisory Database.",
    limitations:
      "Incremental OSV changes since the configured start time; package ecosystems are not universal product coverage. Upstream licenses and attribution apply.",
  },
  {
    ...common,
    id: "core-cve",
    name: "Official CVE List",
    feed_url: endpoints.cve,
    homepage: "https://www.cve.org",
    discovery_url: "https://github.com/CVEProject/cvelistV5",
    allowed_origins: [
      "https://raw.githubusercontent.com",
      "https://www.cve.org",
    ],
    rationale:
      "Published CVE records across software and hardware, preserving CNA affected-product and version semantics.",
    limitations:
      "Rolling delta-log coverage only; an expired checkpoint requires an explicit historical backfill. A CVE record can be incomplete or rejected.",
  },
  {
    ...common,
    id: "core-kev",
    name: "CISA Known Exploited Vulnerabilities",
    feed_url: endpoints.kev,
    homepage: "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
    discovery_url: "https://github.com/cisagov/kev-data",
    allowed_origins: [
      "https://raw.githubusercontent.com",
      "https://www.cisa.gov",
    ],
    rationale:
      "Confirmed exploitation and required-action context from CISA's official machine-readable catalog.",
    limitations:
      "KEV is a selected exploited subset, not a complete vulnerability feed. Federal due dates are not customer-specific patch deadlines.",
  },
];
