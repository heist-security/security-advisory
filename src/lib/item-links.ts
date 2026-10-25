import type { FeedEvent } from "./events";

export const groupIdPattern =
  /^(osv:GHSA-[a-z0-9-]{14}|advisory:[a-f0-9-]{36})$/;
export function groupRouteId(value: string): string | null {
  try {
    // Route params may retain path escaping; API query values are already decoded.
    const id = decodeURIComponent(value);
    return groupIdPattern.test(id) ? id : null;
  } catch {
    return null;
  }
}
export function advisoryPath(id: string) {
  return "/advisories/" + encodeURIComponent(id);
}
export function itemPath(event: FeedEvent) {
  return event.group ? advisoryPath(event.group.id) : "/events/" + event.id;
}
export function returnToFeed(value: string | string[] | undefined) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    // eslint-disable-next-line no-control-regex -- Reject controls before validating a local return URL.
    /[\x00-\x1f\\]/.test(value)
  )
    return "/";
  try {
    const url = new URL(value, "https://feed.invalid");
    return url.origin === "https://feed.invalid" && url.pathname === "/"
      ? url.pathname + url.search
      : "/";
  } catch {
    return "/";
  }
}
export function itemLink(event: FeedEvent, from = "/") {
  const back = returnToFeed(from);
  return (
    itemPath(event) +
    (back === "/" ? "" : "?" + new URLSearchParams({ from: back }))
  );
}
export function summaryPreview(value: string) {
  const text = value
    .replace(/(?:^|\s)#{1,6}\s/g, " ")
    .replace(/[`*]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 220 ? text.slice(0, 217).trimEnd() + "…" : text;
}
