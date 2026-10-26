import type { SourceRecord, StoredItem, Severity } from "./feed-item";
import {
  digest,
  identityKeys,
  itemIdentity,
  reviewed,
  unique,
} from "./identity";
import { technologyFamily, technologyKey } from "./technology";
import { cvssScores } from "./cvss";
const rank = (value: Severity) =>
  ["unknown", "low", "medium", "high", "critical"].indexOf(value);
const semantic = (record: SourceRecord) => {
  const { document_id: _version, ...rest } = record;
  const structured = record.payload.structured;
  return {
    ...rest,
    payload: {
      ...record.payload,
      ...(structured
        ? { structured: { ...structured, modified: undefined } }
        : {}),
    },
  };
};
export function correction(record: SourceRecord): SourceRecord {
  return {
    ...record,
    method: "system",
    payload: {
      security_relevant: true,
      kind: "withdrawal",
      title: "Previous extraction withdrawn",
      summary:
        "A newer source revision was classified as non-security. This corrects our extraction; it is not a publisher retraction.",
      evidence: "",
      products: [],
      related_cves: [],
      fixed_cves: [],
      severity: "unknown",
      severity_evidence: null,
      correction_reason: "reclassified_non_security",
    },
  };
}
function project(
  id: string,
  records: SourceRecord[],
  old: StoredItem | undefined,
  now: string,
): StoredItem {
  records.sort(
    (a, b) =>
      Number(a.payload.kind === "withdrawal") -
        Number(b.payload.kind === "withdrawal") ||
      Number(reviewed(b)) - Number(reviewed(a)) ||
      (a.published_at ?? "z").localeCompare(b.published_at ?? "z") ||
      a.id.localeCompare(b.id),
  );
  const primary = records[0],
    active = records.filter((r) => r.payload.kind !== "withdrawal");
  const products = active.flatMap((r) => r.payload.products);
  const product_names = unique(products.map((p) => p.name.value));
  const fixed_versions = unique(
    products.flatMap((p) => p.fixed_versions.map((v) => v.value)),
  );
  const severity =
    active
      .map((r) => r.payload.severity)
      .sort((a, b) => rank(b) - rank(a))[0] ?? "unknown";
  const known_exploited = active.some(
    (r) =>
      (
        r.payload.structured?.exploitation as
          { known_exploited?: boolean } | undefined
      )?.known_exploited === true,
  );
  const fix_available = fixed_versions.length > 0;
  const kind = primary.payload.kind;
  const technology_ids = unique(
    [
      ...product_names.map(technologyFamily),
      ...records.map((r) => technologyFamily(r.source_id)),
    ].filter(Boolean),
  );
  const source_ids = unique(records.map((r) => r.source_id));
  const cve_ids = unique(
    active.flatMap((r) => r.payload.related_cves.map((c) => c.value)),
  );
  const cvss =
    active
      .flatMap((r) =>
        cvssScores(r.payload.structured?.metrics ?? []).map((score) => ({
          ...score,
          source: r.payload.structured?.id ?? r.source_id,
        })),
      )
      .sort((a, b) => b.score - a.score)[0] ?? null;
  const combinedPatch = kind === "patch" && active.length > 1;
  const important =
    rank(severity) >= 3 ||
    known_exploited ||
    (fix_available && severity === "unknown");
  return {
    id,
    cursor: old?.cursor ?? 0,
    revision: (old?.revision ?? 0) + 1,
    created_at: old?.created_at ?? now,
    updated_at: now,
    source_published_at: primary.published_at,
    active: true,
    replaced_by: [],
    kind,
    title: combinedPatch
      ? product_names.join(", ") + " security updates"
      : primary.payload.title,
    summary: combinedPatch
      ? "Fixed versions: " +
        fixed_versions.join(", ") +
        ". " +
        unique(active.map((r) => r.payload.summary)).join("\n\n")
      : primary.payload.summary,
    product_names,
    fixed_versions,
    affected_versions: unique(
      products.flatMap((p) => p.affected_versions.map((v) => v.value)),
    ),
    cve_ids,
    fixed_cve_ids: unique(
      active.flatMap((r) => (r.payload.fixed_cves ?? []).map((f) => f.cve)),
    ),
    technology_ids,
    source_ids,
    source_urls: unique(records.map((r) => r.url)),
    severity,
    cvss,
    known_exploited,
    fix_available,
    important,
    records,
    record_ids: records.map((r) => r.id).sort(),
    identity_keys: unique([
      ...(old?.identity_keys ?? []),
      ...records.flatMap(identityKeys),
    ]),
    type_keys: unique([
      ...(old?.type_keys ?? []),
      ...records.map((r) => r.payload.kind),
    ]),
    severity_keys: unique([...(old?.severity_keys ?? []), severity]),
    cve_keys: unique([...(old?.cve_keys ?? []), ...cve_ids]),
    technology_keys: unique([
      ...(old?.technology_keys ?? []),
      ...technology_ids,
      ...product_names.map(technologyKey),
    ]),
    source_keys: unique([...(old?.source_keys ?? []), ...source_ids]),
    fix_key: (old?.fix_key ?? false) || fix_available,
    important_key: (old?.important_key ?? false) || important,
  };
}
/** Pure domain operation: reconcile source claims into canonical current items. */
export function reconcile(
  previous: StoredItem[],
  incoming: SourceRecord[],
  now: string,
): StoredItem[] {
  const old = new Map(previous.map((item) => [item.id, item]));
  const assignments = new Map(
    previous
      .filter((i) => i.active)
      .flatMap((i) => i.records.map((r) => [r.id, i.id] as const)),
  );
  const records = new Map(
    previous
      .filter((i) => i.active)
      .flatMap((i) => i.records.map((r) => [r.id, r] as const)),
  );
  for (let record of incoming) {
    const prior = records.get(record.id);
    if (prior && record.document_id < prior.document_id) continue;
    if (!record.payload.security_relevant) {
      if (!prior) continue;
      record = correction(record);
    }
    records.set(record.id, record);
  }
  const all = [...records.values()],
    groups = new Map<string, SourceRecord[]>();
  for (const record of all) {
    const id = itemIdentity(record, all, assignments.get(record.id));
    groups.set(id, [...(groups.get(id) ?? []), record]);
  }
  const changes: StoredItem[] = [];
  for (const [id, members] of groups) {
    const before = old.get(id);
    if (
      before?.active &&
      digest(
        before.records.map(semantic).sort((a, b) => a.id.localeCompare(b.id)),
      ) ===
        digest(members.map(semantic).sort((a, b) => a.id.localeCompare(b.id)))
    )
      continue;
    changes.push(project(id, members, before, now));
  }
  for (const before of previous)
    if (before.active && !groups.has(before.id)) {
      changes.push({
        ...before,
        active: false,
        revision: before.revision + 1,
        updated_at: now,
        replaced_by: unique(
          before.record_ids.flatMap((id) =>
            all
              .filter((r) => r.id === id)
              .map((r) => itemIdentity(r, all, assignments.get(r.id))),
          ),
        ),
      });
    }
  return changes;
}
