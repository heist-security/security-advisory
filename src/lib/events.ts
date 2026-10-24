import { db } from "./db";
import type { Extraction } from "./schema";
import type { EventQuery } from "./filters";
export type FeedEvent = {
  id: number;
  advisory_id: string;
  revision: number;
  source_id: string;
  source_url: string;
  source_published_at: string | null;
  published_at: string;
  extraction_method: string;
  technologies: string[];
  cve_ids: string[];
  event_types: string[];
  payload: Extraction & {
    correction_reason?: string;
    supersedes_event_id?: number;
  };
};
export async function events(options: Partial<EventQuery> = {}) {
  let query = db()
    .from("events")
    .select(
      "id,advisory_id,revision,source_id,source_url,source_published_at,published_at,extraction_method,technologies,cve_ids,event_types,payload",
    )
    .order("id", { ascending: options.after !== undefined })
    .limit(options.limit ?? 30);
  if (options.after !== undefined) query = query.gt("id", options.after);
  if (options.before !== undefined) query = query.lt("id", options.before);
  if (options.type) query = query.contains("event_types", [options.type]);
  if (options.technology)
    query = query.contains("technologies", [options.technology]);
  if (options.cve) query = query.contains("cve_ids", [options.cve]);
  if (options.source) query = query.eq("source_id", options.source);
  if (options.q)
    query = query.textSearch("search_document", options.q, {
      type: "plain",
      config: "simple",
    });
  const { data, error } = await query;
  if (error) throw error;
  return data as FeedEvent[];
}
export function xml(value: string) {
  return value
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
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "");
}
export function rss(
  rows: FeedEvent[],
  base: string,
  self = base + "/feed.xml",
) {
  const items = rows
    .map((row) => {
      const summary =
        row.payload.summary +
        "\n\n" +
        (row.extraction_method === "system"
          ? "Automated extraction correction."
          : "Machine-extracted; verify the original source.") +
        " Revision " +
        row.revision +
        ".";
      // RSS descriptions contain HTML. Escape once for HTML text and again for XML transport.
      return (
        "<item><title>" +
        xml(row.payload.title) +
        "</title><link>" +
        xml(row.source_url) +
        '</link><guid isPermaLink="false">heist-event:' +
        row.id +
        "</guid><pubDate>" +
        new Date(row.published_at).toUTCString() +
        "</pubDate><category>" +
        xml(row.payload.kind) +
        "</category><description>" +
        xml(xml(summary)) +
        "</description></item>"
      );
    })
    .join("");
  return (
    '<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Heist Feed</title><link>' +
    xml(base) +
    "</link><description>One feed for security advisories, patches and mitigations.</description><language>en</language>" +
    '<atom:link href="' +
    xml(self) +
    '" rel="self" type="application/rss+xml"/>' +
    items +
    "</channel></rss>"
  );
}
