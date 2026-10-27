import type { FeedItem } from "../domain/feed-item";
import { filterQuery, type Filters } from "./filters";
export function feedLink(filters: Filters, extra: Record<string, string> = {}) {
  const params = filterQuery(filters);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return "/" + (params.size ? "?" + params : "");
}
function itemDay(value: string) {
  return new Date(value).toISOString().slice(0, 10);
}
export function dayLabel(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(value + "T12:00:00Z"));
}
export function feedTimestamp(value: string) {
  return (
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    }).format(new Date(value)) + " UTC"
  );
}
export function groupByDay(rows: FeedItem[]) {
  const groups: { day: string; items: FeedItem[] }[] = [];
  for (const item of rows) {
    const day = itemDay(item.updated_at);
    const last = groups.at(-1);
    if (last?.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
