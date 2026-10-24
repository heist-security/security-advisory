import type { FeedEvent } from "./events";
import { filterQuery, type Filters } from "./filters";
export const typeLabels = {
  advisory: "Advisories",
  patch: "Patches",
  mitigation: "Mitigations",
  withdrawal: "Withdrawals",
  other: "Other",
};
export function feedLink(filters: Filters, extra: Record<string, string> = {}) {
  const params = filterQuery(filters);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return "/" + (params.size ? "?" + params : "");
}
export function eventDay(value: string) {
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
export function groupEvents(rows: FeedEvent[]) {
  const groups: { day: string; events: FeedEvent[] }[] = [];
  for (const event of rows) {
    const day = eventDay(event.published_at);
    const last = groups.at(-1);
    if (last?.day === day) last.events.push(event);
    else groups.push({ day, events: [event] });
  }
  return groups;
}
