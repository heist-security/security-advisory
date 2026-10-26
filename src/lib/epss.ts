import type { riskContext } from "./structured/risk";

type RiskResponse = Awaited<ReturnType<typeof riskContext>>;
export type EpssScore = NonNullable<RiskResponse["data"][number]["epss"]>;
export type EpssScores = Record<string, EpssScore | null>;

// Reuse the cached risk endpoint, deduplicate CVEs, and bound both request size
// and concurrency for advisories that refer to many vulnerabilities.
export async function loadEpss(ids: string[], signal: AbortSignal) {
  const unique = [...new Set(ids)].sort();
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += 40)
    batches.push(unique.slice(i, i + 40));
  const scores: EpssScores = {};
  await Promise.all(
    Array.from({ length: Math.min(3, batches.length) }, async () => {
      while (batches.length && !signal.aborted) {
        const batch = batches.shift()!;
        for (const id of batch) scores[id] = null;
        try {
          const response = await fetch(
            "/api/v1/risk?" + new URLSearchParams({ cve: batch.join(",") }),
            { signal: AbortSignal.any([signal, AbortSignal.timeout(15000)]) },
          );
          if (!response.ok) continue;
          const result: RiskResponse = await response.json();
          if (result.availability.epss !== "available") continue;
          for (const row of result.data) {
            if (batch.includes(row.cve)) scores[row.cve] = row.epss;
          }
        } catch {
          // An enrichment outage must leave the feed and other batches usable.
        }
      }
    }),
  );
  return scores;
}

export function epssPercent(score: number) {
  const percent = score * 100;
  if (percent > 0 && percent < 0.01) return "<0.01%";
  // Keep very small nonzero forecasts distinct from a reported zero.
  return percent.toFixed(percent < 1 ? 2 : 1) + "%";
}
