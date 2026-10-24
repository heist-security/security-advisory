import data from "../../sources/registry.json";
import type { Source } from "./feed";
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
export const registry = data as RegistrySource[];
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
  const filtered = registry.filter(
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
    rows: filtered.slice((page - 1) * 24, page * 24),
    total: filtered.length,
    page,
    pages,
    q,
    channel,
    category,
  };
}
