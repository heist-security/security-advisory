import { db } from "./db";
import type { Extraction } from "./schema";
import { filterQuery, type EventQuery } from "./filters";
import { databaseFailureReason } from "./errors";
import {
  groupedEvents,
  publicEvent,
  type AdvisoryGroup,
} from "./advisory-groups";
import type { StructuredPayload } from "./structured/normalize";
import { priorityLabels, type Priority } from "./priority";
import { technologyFamily } from "./technology";
import { itemPath } from "./item-links";
export type FeedEvent = {
  detail_url?: string;
  group_id?: string | null;
  group?: AdvisoryGroup;
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
export async function events(
  options: Partial<EventQuery> = {},
  updates = false,
) {
  const started = performance.now();
  try {
    return await readEvents(options, updates);
  } catch (error) {
    console.error(
      JSON.stringify({
        operation: "feed_query",
        reason: databaseFailureReason(error),
        view: options.view ?? "events",
        filters: [...filterQuery(options).keys()].filter(
          (key) => key !== "view",
        ),
        updates: updates || options.after !== undefined,
        duration_ms: Math.round(performance.now() - started),
      }),
    );
    throw error;
  }
}
async function readEvents(options: Partial<EventQuery>, updates: boolean) {
  if (options.view === "grouped") return groupedEvents(options, updates);
  let query = db()
    .from("events")
    .select(
      "id,advisory_id,group_id,revision,source_id,source_url,source_published_at,published_at,extraction_method,technologies,cve_ids,event_types,payload,priority,context_update",
    )
    .order("id", { ascending: options.after !== undefined })
    .limit(options.limit ?? 30);
  if (options.after !== undefined) query = query.gt("id", options.after);
  if (options.before !== undefined) query = query.lt("id", options.before);
  if (options.type?.length) query = query.overlaps("event_types", options.type);
  if (options.technology) {
    const ids = [
      ...new Set(options.technology.split(",").map(technologyFamily)),
    ];
    // Canonical IDs for new subscriptions; original routing keys keep existing
    // package/source subscriptions and historical corrections working.
    query = query.or(
      `technology_ids.ov.{${ids.join(",")}},technologies.ov.{${ids.join(",")}}`,
    );
  }
  if (options.cve) query = query.contains("cve_ids", [options.cve]);
  if (options.source) query = query.eq("source_id", options.source);
  if (options.group) query = query.eq("group_id", options.group);
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
  return (data as FeedEvent[]).map(publicEvent);
}
export async function eventById(id: number): Promise<FeedEvent | null> {
  const { data, error } = await db()
    .from("events")
    .select(
      "id,advisory_id,group_id,revision,source_id,source_url,source_published_at,published_at,extraction_method,technologies,cve_ids,event_types,payload,priority,context_update",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? publicEvent(data as FeedEvent) : null;
}
function xml(value: string) {
  return (
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
      // eslint-disable-next-line no-control-regex -- Strip characters forbidden by XML 1.0.
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g, "")
  );
}
export function rss(
  rows: FeedEvent[],
  base: string,
  self = base + "/feed.xml",
) {
  const items = rows
    .map((row) => {
      const title =
        (row.group?.superseded_by.length
          ? "Grouping updated: "
          : row.group?.changed.payload.kind === "withdrawal"
            ? "Source withdrawn: "
            : "") + row.payload.title;
      const summary =
        row.payload.summary +
        (row.group
          ? "\n\nSources:\n" +
            row.group.members
              .map(
                (member) =>
                  (member.payload.structured?.id ?? member.source_id) +
                  " — " +
                  member.source_url +
                  "\n" +
                  (member.payload.kind === "withdrawal"
                    ? "Withdrawn source record."
                    : member.payload.products
                        .map(
                          (product) =>
                            product.name.value +
                            (product.fixed_versions.length
                              ? ": fixed in " +
                                product.fixed_versions
                                  .map((v) => v.value)
                                  .join(", ")
                              : ": fix not stated in this record"),
                        )
                        .join("\n")),
              )
              .join("\n\n") +
            (row.group.change !== "published"
              ? "\n\nUpdated source: " +
                row.group.changed.source_url +
                "\n" +
                row.group.changed.payload.summary
              : "") +
            (row.group.superseded_by.length
              ? "\nGroup membership corrected. Replacement groups: " +
                row.group.superseded_by.join(", ")
              : "")
          : "") +
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
        xml(title) +
        "</title><link>" +
        xml(row.group ? base + itemPath(row) : row.source_url) +
        '</link><guid isPermaLink="false">' +
        (row.group ? "heist-group-update:" : "heist-event:") +
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
