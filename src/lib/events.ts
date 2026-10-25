import { db } from "./db";
import type { Extraction } from "./schema";
import type { EventQuery } from "./filters";
import { isStructured } from "./structured/config";
import type { StructuredPayload } from "./structured/normalize";
import { priorityLabels, type Priority } from "./priority";
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
  priority?: Priority;
  context_update?: boolean;
  payload: Extraction & {
    structured?: StructuredPayload["structured"];
    correction_reason?: string;
    supersedes_event_id?: number;
  };
};
export async function events(options: Partial<EventQuery> = {}) {
  let query = db()
    .from("events")
    .select(
      "id,advisory_id,revision,source_id,source_url,source_published_at,published_at,extraction_method,technologies,cve_ids,event_types,payload,priority,context_update",
    )
    .order("id", { ascending: options.after !== undefined })
    .limit(options.limit ?? 30);
  if (options.after !== undefined) query = query.gt("id", options.after);
  if (options.before !== undefined) query = query.lt("id", options.before);
  if (options.type) query = query.contains("event_types", [options.type]);
  if (options.technology)
    query = query.overlaps("technologies", options.technology.split(","));
  if (options.cve) query = query.contains("cve_ids", [options.cve]);
  if (options.source) query = query.eq("source_id", options.source);
  if (options.severity?.length)
    query = query.overlaps("severity_keys", options.severity);
  if (options.important) query = query.eq("important", true);
  if (options.fix) query = query.eq("fix_available", true);
  if (options.q)
    query = query.textSearch("search_document", options.q, {
      type: "plain",
      config: "simple",
    });
  const { data, error } = await query;
  if (error) throw error;
  return (data as FeedEvent[]).map((row) => ({
    ...row,
    // Existing publication RPC labels all imports "llm". Interpret reviewed structured source
    // provenance at the read boundary until that database metadata is extended separately.
    extraction_method:
      isStructured(row.source_id) &&
      row.payload.structured &&
      row.extraction_method !== "system"
        ? "structured"
        : row.extraction_method,
  }));
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
        (row.priority
          ? "\n\n" + priorityLabels(row.priority).join(" · ")
          : "") +
        (row.context_update
          ? "\nCVE context updated; this is not a new publisher release."
          : "") +
        (row.priority?.linked_cves.length
          ? "\nLinked ratings describe the referenced CVEs and their products, not every use of this dependency.\n" +
            row.priority.linked_cves
              .map(
                (c) =>
                  c.cve +
                  ": " +
                  c.severity +
                  " (" +
                  c.products.map((p) => p.name.value).join(", ") +
                  ") — " +
                  c.source_url,
              )
              .join("\n")
          : "") +
        "\n\n" +
        (row.extraction_method === "system"
          ? "Automated extraction correction."
          : row.extraction_method === "structured"
            ? "Imported from structured advisory data; verify the original source."
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
