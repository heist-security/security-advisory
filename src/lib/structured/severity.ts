import { CVSS30, CVSS31, CVSS40 } from "@pandatix/js-cvss";
import type { Severity } from "../priority";

// Use a validated scoring implementation; a vector is not itself a severity
// label. Unsupported or malformed metrics do not prevent advisory ingestion.
export function osvSeverity(metrics: Record<string, unknown>[]) {
  let highest:
    | { score: number; severity: Exclude<Severity, "unknown">; index: number }
    | undefined;
  for (const [index, metric] of metrics.entries()) {
    if (typeof metric.score !== "string") continue;
    let score: number;
    try {
      if (metric.type === "CVSS_V4" && metric.score.startsWith("CVSS:4.0/"))
        score = new CVSS40(metric.score).Score();
      else if (
        metric.type === "CVSS_V3" &&
        metric.score.startsWith("CVSS:3.1/")
      )
        score = new CVSS31(metric.score).BaseScore();
      else if (
        metric.type === "CVSS_V3" &&
        metric.score.startsWith("CVSS:3.0/")
      )
        score = new CVSS30(metric.score).BaseScore();
      else continue;
    } catch {
      continue;
    }
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
