import { CVSS20, CVSS30, CVSS31, CVSS40 } from "@pandatix/js-cvss";

export type CvssScore = { score: number; version: string };
const versions = {
  cvssV4_0: "4.0",
  cvssV3_1: "3.1",
  cvssV3_0: "3.0",
  cvssV2_0: "2.0",
};
const record = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const validScore = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 10;

export function osvCvssScore(
  metric: Record<string, unknown>,
): CvssScore | null {
  if (typeof metric.score !== "string") return null;
  try {
    let rating: CvssScore;
    if (metric.type === "CVSS_V4" && metric.score.startsWith("CVSS:4.0/"))
      rating = { score: new CVSS40(metric.score).Score(), version: "4.0" };
    else if (metric.type === "CVSS_V3" && metric.score.startsWith("CVSS:3.1/"))
      rating = { score: new CVSS31(metric.score).BaseScore(), version: "3.1" };
    else if (metric.type === "CVSS_V3" && metric.score.startsWith("CVSS:3.0/"))
      rating = { score: new CVSS30(metric.score).BaseScore(), version: "3.0" };
    else if (metric.type === "CVSS_V2")
      rating = { score: new CVSS20(metric.score).BaseScore(), version: "2.0" };
    else return null;
    return validScore(rating.score) ? rating : null;
  } catch {
    return null;
  }
}

// Native CVE metrics contain numeric base scores; OSV contains CVSS vectors.
// Never infer a numeric score from a severity label.
export function cvssScores(metrics: unknown[]): CvssScore[] {
  return metrics.flatMap((metric) => {
    if (!record(metric)) return [];
    const osv = osvCvssScore(metric);
    if (osv) return [osv];
    return Object.entries(versions).flatMap(([key, version]) => {
      const value = metric[key];
      return record(value) && validScore(value.baseScore)
        ? [{ score: value.baseScore, version }]
        : [];
    });
  });
}
