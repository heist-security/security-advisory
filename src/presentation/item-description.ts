import type { FeedItem, ItemKind } from "../domain/feed-item";

const kindLabels: Record<ItemKind, string> = {
  advisory: "Security advisory",
  patch: "Security update",
  mitigation: "Security mitigation",
  withdrawal: "Withdrawn security advisory",
  other: "Security notice",
};
const identifierPattern =
  /^(?:CVE-\d{4}-\d{4,}|(?:CGA|GHSA)-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4})$/i;

/** Reader-facing copy, derived from known facts without changing source evidence. */
export function itemDescription(item: FeedItem) {
  const ids = new Set([
    ...item.cve_ids,
    ...item.records.flatMap((record) => {
      const structured = record.payload.structured;
      return structured
        ? [structured.id, ...structured.aliases, ...(structured.upstream ?? [])]
        : [];
    }),
  ]);
  const isIdentifier = (value: string) =>
    ids.has(value.trim()) || identifierPattern.test(value.trim());
  const originalTitle = item.title.trim();
  const originalSummary = item.summary.trim();
  const products = item.product_names.slice(0, 2).join(", ");
  const subject =
    products +
    (item.product_names.length > 2
      ? ` and ${item.product_names.length - 2} more products`
      : "");
  const title =
    originalTitle && !isIdentifier(originalTitle)
      ? originalTitle
      : subject
        ? `${subject} — ${kindLabels[item.kind].toLowerCase()}`
        : kindLabels[item.kind];

  let summary = originalSummary;
  if (!summary || isIdentifier(summary)) {
    if (item.kind === "withdrawal") {
      summary = "The source has withdrawn this advisory.";
    } else {
      const cves = item.cve_ids.slice(0, 2).join(", ");
      const references =
        cves +
        (item.cve_ids.length > 2
          ? ` and ${item.cve_ids.length - 2} more CVEs`
          : "");
      summary =
        (references
          ? `This notice tracks ${references}`
          : kindLabels[item.kind]) + (subject ? ` for ${subject}.` : ".");
      if (item.active && item.fix_available && item.fixed_versions.length) {
        // Flattened versions cannot be assigned to individual products here.
        summary +=
          item.product_names.length === 1
            ? ` Fixed in: ${item.fixed_versions.slice(0, 3).join(", ")}${item.fixed_versions.length > 3 ? " (and other releases)" : ""}.`
            : " Fixed versions are listed in the package details.";
      }
    }
  }
  if (summary === title) summary = "";

  // Keep the opaque headline discoverable, with an explanation of its origin.
  const identifiers = [...new Set([originalTitle, originalSummary])]
    .filter((value) => value && isIdentifier(value))
    .map((id) => ({
      id,
      label: id.startsWith("CGA-")
        ? "Chainguard advisory"
        : id.startsWith("GHSA-")
          ? "GitHub advisory"
          : id.startsWith("CVE-")
            ? "CVE"
            : "Advisory ID",
    }));
  return { title, summary, identifiers };
}
