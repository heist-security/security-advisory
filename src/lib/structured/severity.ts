import { osvCvssScore } from "../cvss";
import type { Severity } from "../priority";

// Use a validated scoring implementation; a vector is not itself a severity
// label. Unsupported or malformed metrics do not prevent advisory ingestion.
export function osvSeverity(metrics: Record<string, unknown>[]) {
  let highest:
    | { score: number; severity: Exclude<Severity, "unknown">; index: number }
    | undefined;
  for (const [index, metric] of metrics.entries()) {
    // Preserve the ingestion policy: only v3/v4 determine feed severity.
    if (metric.type !== "CVSS_V3" && metric.type !== "CVSS_V4") continue;
    const rating = osvCvssScore(metric);
    if (!rating) continue;
    const { score } = rating;
    // The feed has no "none" severity. Preserve zero in native metrics without
    // mislabelling it as a low-severity vulnerability.
    if (!Number.isFinite(score) || score <= 0 || score > 10) continue;
    if (!highest || score > highest.score)
      highest = {
        score,
        severity:
          score >= 9
            ? "critical"
            : score >= 7
              ? "high"
              : score >= 4
                ? "medium"
                : "low",
        index,
      };
  }
  return highest;
}
