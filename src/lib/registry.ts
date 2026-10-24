import data from "../../sources/registry.json";
import type { Source } from "./feed";
export type RegistrySource = Source & { verification: { checked_at: string; status: string; warnings: string[]; sample_url: string; sample_characters: number; scope: string } };
export const registry = data as RegistrySource[];
export const channelCounts = Object.fromEntries(["security-advisories", "mixed-announcements", "release-notes"].map(channel => [channel, registry.filter(source => source.channel === channel).length]));
export const categoryCount = new Set(registry.map(source => source.category)).size;
