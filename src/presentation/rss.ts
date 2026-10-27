import type { FeedItem } from "../domain/feed-item";
import { itemPath } from "./item-links";
import { itemDescription } from "./item-description";
const xml = (value: string) =>
  value
    .replace(
      /[<>&"']/g,
      (c) =>
        ({
          "<": "&lt;",
          ">": "&gt;",
          "&": "&amp;",
          '"': "&quot;",
          "'": "&apos;",
        })[c]!,
    )
    // eslint-disable-next-line no-control-regex -- XML 1.0 cannot contain these characters.
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
export function rss(
  items: FeedItem[],
  base: string,
  self = base + "/feed.xml",
) {
  return (
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Heist Feed</title><link>' +
    xml(base) +
    '</link><description>Security advisories and patches.</description><atom:link href="' +
    xml(self) +
    '" rel="self" type="application/rss+xml"/>' +
    items
      .map((item) => {
        const display = itemDescription(item);
        const description =
          "Revision " +
          item.revision +
          "\n\n" +
          display.summary +
          (display.identifiers.length
            ? "\n\n" +
              display.identifiers
                .map(({ id, label }) => `${label}: ${id}`)
                .join("\n")
            : "") +
          "\n\nFixed versions: " +
          item.fixed_versions.join(", ") +
          "\n\nSources:\n" +
          item.records
            .map((r) => r.url + "\n" + r.payload.summary)
            .join("\n\n") +
          (item.active
            ? ""
            : "\nReplaced by: " +
              item.replaced_by.map((id) => base + itemPath({ id })).join(", "));
        return (
          "<item><title>" +
          xml((item.active ? "" : "Grouping updated: ") + display.title) +
          "</title><link>" +
          xml(base + itemPath(item)) +
          '</link><guid isPermaLink="false">heist-item:' +
          item.id +
          ":" +
          item.revision +
          "</guid><pubDate>" +
          new Date(item.updated_at).toUTCString() +
          "</pubDate><category>" +
          xml(item.kind) +
          "</category><description>" +
          xml(xml(description)) +
          "</description></item>"
        );
      })
      .join("") +
    "</channel></rss>"
  );
}
