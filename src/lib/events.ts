import { db } from "./db";
import type { Extraction } from "./schema";
export type FeedEvent = {
  id: number; advisory_id: string; revision: number; source_id: string;
  source_url: string; source_published_at: string | null; published_at: string;
  extraction_method: string; payload: Extraction;
};
export async function events(options: { after?: number; limit?: number; kind?: string; cve?: string } = {}) {
  let query = db().from("events").select("id,advisory_id,revision,source_id,source_url,source_published_at,published_at,extraction_method,payload")
    .order("id", { ascending: options.after !== undefined }).limit(options.limit ?? 30);
  if (options.after !== undefined) query = query.gt("id", options.after);
  if (options.kind) query = query.eq("payload->>kind", options.kind);
  if (options.cve) query = query.contains("payload", { related_cves: [{ value: options.cve }] });
  const { data, error } = await query;
  if (error) throw error;
  return data as FeedEvent[];
}
export function xml(value: string) { return value.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ""); }
export function rss(rows: FeedEvent[], base: string) {
  return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom"><channel><title>Heist Feed</title><link>${xml(base)}</link><description>Security advisories, patches and mitigations, with sources.</description><language>en</language><atom:link href="${xml(base)}/feed.xml" rel="self" type="application/rss+xml"/>${rows.map(row => `<item><title>${xml(row.payload.title)}</title><link>${xml(row.source_url)}</link><guid isPermaLink="false">heist-event:${row.id}</guid><pubDate>${new Date(row.published_at).toUTCString()}</pubDate><category>${row.payload.kind}</category><description>${xml(`${row.payload.summary}\n\nMachine-extracted; verify the original source. Revision ${row.revision}.`)}</description></item>`).join("")}</channel></rss>`;
}
