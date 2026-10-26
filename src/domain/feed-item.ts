import type { EvidencePayload } from "./evidence";
export const severities = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown",
] as const;
export type Severity = (typeof severities)[number];
export const itemKinds = [
  "advisory",
  "patch",
  "mitigation",
  "withdrawal",
  "other",
] as const;
export type ItemKind = (typeof itemKinds)[number];
export const severityLabel = (value: Severity) =>
  value === "unknown" ? "Unrated" : value[0].toUpperCase() + value.slice(1);

/** One publisher's current claim. Evidence and native version semantics stay intact. */
export type SourceRecord = {
  id: string;
  source_id: string;
  url: string;
  published_at: string | null;
  document_id: number;
  method: "structured" | "llm" | "system";
  payload: EvidencePayload;
};
/** The canonical item, not a projection of another public event/group model. */
export type FeedItem = {
  id: string;
  cursor: number;
  revision: number;
  created_at: string;
  updated_at: string;
  source_published_at: string | null;
  active: boolean;
  replaced_by: string[];
  kind: ItemKind;
  title: string;
  summary: string;
  product_names: string[];
  affected_versions: string[];
  fixed_versions: string[];
  cve_ids: string[];
  fixed_cve_ids: string[];
  technology_ids: string[];
  source_ids: string[];
  source_urls: string[];
  severity: Severity;
  cvss: { score: number; version: string; source: string } | null;
  known_exploited: boolean;
  fix_available: boolean;
  important: boolean;
  records: SourceRecord[];
};
/** Persistence-only keys retain subscription matches after corrections. */
export type StoredItem = FeedItem & {
  record_ids: string[];
  identity_keys: string[];
  type_keys: string[];
  severity_keys: string[];
  cve_keys: string[];
  technology_keys: string[];
  source_keys: string[];
  fix_key: boolean;
  important_key: boolean;
};
export type FeedQuery = {
  q?: string;
  type?: ItemKind[];
  severity?: Severity[];
  technology?: string;
  source?: string;
  cve?: string;
  important?: "1";
  fix?: "1";
  after?: number;
  before?: number;
  limit: number;
};
export function publicItem(item: StoredItem): FeedItem {
  const {
    record_ids: _records,
    identity_keys: _identities,
    type_keys: _types,
    severity_keys: _severity,
    cve_keys: _cves,
    technology_keys: _tech,
    source_keys: _sources,
    fix_key: _fix,
    important_key: _important,
    ...value
  } = item;
  return value;
}
