export const severities = [
  "critical",
  "high",
  "medium",
  "low",
  "unknown",
] as const;
export type Severity = (typeof severities)[number];
export type Priority = {
  severity: Severity;
  publisher_severity: Severity;
  fix_available: boolean;
  known_exploited: boolean;
  reasons: string[];
  linked_cves: {
    cve: string;
    relationship: "fixes" | "advisory";
    relationship_evidence: string;
    source_id: string;
    source_url: string;
    severity: Severity;
    products: { name: { value: string } }[];
    metrics: unknown[];
    known_exploited: boolean;
  }[];
};
export const severityLabel = (s: Severity) =>
  s === "unknown" ? "Unrated" : s[0].toUpperCase() + s.slice(1);
export function priorityLabels(p?: Priority) {
  if (!p) return [];
  const labels: string[] = [];
  if (p.publisher_severity !== "unknown")
    labels.push(severityLabel(p.publisher_severity));
  const linked = severities.find(
    (s) => s !== "unknown" && p.linked_cves.some((c) => c.severity === s),
  );
  if (linked) labels.push("Linked " + severityLabel(linked) + " CVE");
  if (p.known_exploited) labels.push("Known exploited CVE");
  if (p.fix_available)
    labels.push(
      p.severity === "unknown" ? "Security fix · Unrated" : "Fix available",
    );
  if (!labels.length) labels.push("Unrated");
  return labels;
}
