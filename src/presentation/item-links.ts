import type { FeedItem } from "../domain/feed-item";
export const validItemId = (value: string) => /^[a-f0-9]{64}$/.test(value);
export const itemPath = (item: Pick<FeedItem, "id">) => "/items/" + item.id;
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
export function itemLink(item: Pick<FeedItem, "id">, from = "/") {
  const back = returnToFeed(from);
  return (
    itemPath(item) +
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
