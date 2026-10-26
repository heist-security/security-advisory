import type { FeedEvent } from "./events";
import { cvssScores, type CvssScore } from "./cvss";

function activeMembers(event: FeedEvent) {
  if (event.payload.kind === "withdrawal") return [];
  return (event.group?.members ?? [event]).filter(
    (member) => member.payload.kind !== "withdrawal",
  );
}

export function scoreCves(event: FeedEvent): string[] {
  // cve_ids includes historical routing keys kept for correction delivery.
  // Use current payloads so removed CVE associations never acquire badges.
  return [
    ...new Set(
      activeMembers(event).flatMap((member) =>
        member.payload.related_cves.map((cve) => cve.value),
      ),
    ),
  ]
    .filter((id) => /^CVE-\d{4}-\d{4,19}$/.test(id))
    .sort();
}

export function advisoryCvss(event: FeedEvent) {
  let highest: (CvssScore & { source: string }) | null = null;
  for (const member of activeMembers(event)) {
    const structured = member.payload.structured;
    const sources = [
      {
        metrics: structured?.metrics ?? [],
        source: structured?.id ?? member.source_id,
      },
      ...(member.priority?.linked_cves ?? []).map((link) => ({
        metrics: link.metrics,
        source: link.cve,
      })),
    ];
    for (const source of sources) {
      for (const rating of cvssScores(source.metrics)) {
        if (!highest || rating.score > highest.score)
          highest = { ...rating, source: source.source };
      }
    }
  }
  return highest;
}
