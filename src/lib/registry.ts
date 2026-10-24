import data from "../../sources/registry.json";
import type { Source } from "./feed";
import { structuredSources } from "./structured/config";
export type RegistrySource = Source & {
  verification: {
    checked_at: string;
    status: string;
    warnings: string[];
    sample_url: string;
    sample_characters: number;
    scope: string;
  };
};
export const vendorRegistry = data as RegistrySource[];
const selectedVendors = new Set(
  (process.env.VENDOR_SOURCE_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean),
);
export const registry: RegistrySource[] = [
  ...structuredSources.map((source) => ({
    ...source,
    verification: {
      checked_at: "",
      status: "configured",
      warnings: [],
      sample_url: source.discovery_url,
      sample_characters: 0,
      scope:
        "Structured adapter; live status is available from authenticated health monitoring.",
    },
  })),
  ...vendorRegistry.filter((source) => selectedVendors.has(source.id)),
];
export const channelCounts = Object.fromEntries(
  ["security-advisories", "mixed-announcements", "release-notes"].map(
    (channel) => [
      channel,
      registry.filter((source) => source.channel === channel).length,
    ],
  ),
);
export const categories = [
  ...new Set(registry.map((source) => source.category)),
].sort();
export const categoryCount = categories.length;
export function sourcePage(params: URLSearchParams) {
  const q = (params.get("q") ?? "").slice(0, 100).toLowerCase();
  const channel = params.get("channel") ?? "",
    category = params.get("category") ?? "";
  const requested = Number(params.get("page") ?? 1);
  const catalog =
    params.get("catalog") === "vendor" ? vendorRegistry : registry;
  const filtered = catalog.filter(
    (s) =>
      (!q || (s.name + " " + s.category).toLowerCase().includes(q)) &&
      (!channel || s.channel === channel) &&
      (!category || s.category === category),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const page = Number.isSafeInteger(requested)
    ? Math.max(1, Math.min(requested, pages))
    : 1;
  return {
    catalog_count: catalog.length,
    catalog_channel_counts: Object.fromEntries(
      ["security-advisories", "mixed-announcements", "release-notes"].map(
        (channel) => [
          channel,
          catalog.filter((source) => source.channel === channel).length,
        ],
      ),
    ),
    catalog_categories: [
      ...new Set(catalog.map((source) => source.category)),
    ].sort(),
    rows: filtered.slice((page - 1) * 24, page * 24),
    total: filtered.length,
    page,
    pages,
    q,
    channel,
    category,
  };
}
