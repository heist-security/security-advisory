import type { FeedEvent } from "./events";
import { filterQuery, type Filters } from "./filters";
export function feedLink(filters: Filters, extra: Record<string, string> = {}) {
  const params = filterQuery(filters);
  for (const [key, value] of Object.entries(extra)) params.set(key, value);
  return "/" + (params.size ? "?" + params : "");
}
function eventDay(value: string) {
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
