import type { EvidencePayload } from "../../src/domain/evidence";
import type { FeedItem, SourceRecord } from "../../src/domain/feed-item";
import { recordId } from "../../src/domain/identity";
import { reconcile } from "../../src/domain/reconcile";
export const at = "2026-10-26T10:00:00.000Z";
export const fact = (value: string) => ({ value, evidence: value });
export function payload(
  version = "2.4.1",
  cves = ["CVE-2026-53493"],
): EvidencePayload {
  return {
    security_relevant: true,
    kind: "patch",
    title: "containerd " + version,
    summary: "containerd fixes " + cves.join(", "),
    evidence: "containerd security update",
    products: [
      {
        name: fact("containerd"),
        affected_versions: [fact("<" + version)],
        fixed_versions: [fact(version)],
        prerequisites: [],
      },
    ],
    related_cves: cves.map(fact),
    fixed_cves: cves.map((cve) => ({
      cve,
      product: "containerd",
      evidence: "containerd fixes " + cve,
    })),
    severity: "unknown",
    severity_evidence: null,
  };
}
export function record(
  version = "2.4.1",
  changes: Partial<SourceRecord> = {},
): SourceRecord {
  const source_id = changes.source_id ?? "github-containerd-containerd",
    url =
      changes.url ??
      "https://github.com/containerd/containerd/releases/tag/v" + version;
  return {
    id: recordId(source_id, url),
    source_id,
    url,
    published_at: at,
    document_id: 1,
    method: "llm",
    payload: payload(version),
    ...changes,
  };
}
export function itemFixture(changes: Partial<FeedItem> = {}): FeedItem {
  return { ...reconcile([], [record()], at)[0], cursor: 1, ...changes };
}
