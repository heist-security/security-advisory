import Parser, { type Item } from "rss-parser";
import { load } from "cheerio";
import { z } from "zod";
import { allowedUrl, fetchText } from "./http";

export const sourceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/), name: z.string().min(1),
  category: z.string().min(1),
  channel: z.enum(["security-advisories", "mixed-announcements", "release-notes"]),
  adapter: z.enum(["article", "feed-content"]),
  feed_url: z.url(), homepage: z.url(), discovery_url: z.url(),
  allowed_origins: z.array(z.url()).min(1),
  item_url_prefix: z.string().nullable(),
  poll_interval_minutes: z.number().int().min(15).max(1440),
  max_feed_bytes: z.number().int().min(100000).max(10000000).default(2000000),
  rationale: z.string().min(20), limitations: z.string().min(20),
  exclude_reason: z.string().optional(),
  discovery_notes: z.string().optional(),
});
export type Source = z.infer<typeof sourceSchema>;
export class NoReleaseNotesError extends Error {}
export function cleanText(html: string) {
  const $ = load(html);
  $("script,style,nav,footer,header,aside,noscript").remove();
  $("p,li,div,h1,h2,h3,h4,h5,h6,br,tr,td,pre").append(" ");
  return $.text().replace(/\s+/g, " ").trim();
}
export function articleText(html: string) {
  const $ = load(html);
  if (/just a moment|access denied|making sure you.re not a bot|verify you are human|site unavailable/i.test($("title").text())) throw new Error("Source returned a challenge, access-denied or unavailable page");
  $("script,style,nav,footer,header,aside,noscript").remove();
  const article = $("article").first(); const main = $("main").first();
  const selected = article.length ? article : main.length ? main : $("body");
  return boundedText(cleanText(selected.html() ?? ""));
}
export function boundedText(text: string) {
  if (!text || text.length > 50000) throw new Error("Empty or oversized document; requires a dedicated adapter");
  return text;
}
export async function parseFeed(xml: string) {
  const outsideCdata = xml.replace(/<!\[CDATA\[[\s\S]*?\]\]>/g, "");
  if (/<html[\s>]/i.test(outsideCdata.slice(0, 2000))) throw new Error("Endpoint returned HTML instead of RSS/Atom (unavailable, changed or challenged)");
  if (/<!DOCTYPE|<!ENTITY/i.test(outsideCdata)) throw new Error("XML declarations not supported");
  return new Parser().parseString(xml);
}
export function itemUrl(source: Pick<Source, "allowed_origins" | "item_url_prefix" | "feed_url">, item: Item) {
  if (!item.link) throw new Error("Feed item has no URL");
  const resolved = new URL(item.link, source.feed_url);
  // Some longstanding publishers still emit HTTP links. Fetch only HTTPS,
  // and only when that exact upgraded origin was explicitly allowlisted.
  if (resolved.protocol === "http:" && source.allowed_origins.includes(`https://${resolved.host}`)) resolved.protocol = "https:";
  const url = allowedUrl(resolved.toString(), source.allowed_origins);
  if (source.item_url_prefix && !url.toLowerCase().startsWith(source.item_url_prefix.toLowerCase())) throw new Error("Item outside source path");
  return url;
}
export function inlineText(item: Item, feedTitle?: string) {
  const extended = item as Item & { "content:encoded"?: string };
  const body = extended["content:encoded"] || item.content || item.summary || "";
  const content = cleanText(body);
  // GitHub often synthesizes tag-only entries. Do not pass those off as release notes.
  if (content.length < 80 && !/\bCVE-\d{4}-\d+|\bsecur(?:ity|e)|vulnerab|\bGHSA-/i.test(content)) throw new NoReleaseNotesError("Feed item lacks substantive release notes");
  // The publisher's feed title supplies project identity when an entry title
  // is only a version number. It is source text, not an invented product label.
  return boundedText(`${feedTitle ?? ""}\n${item.title ?? ""}\n\n${content}`.trim());
}
export async function documentText(source: Source, item: Item, feedTitle?: string) {
  const url = itemUrl(source, item);
  const body = source.adapter === "feed-content" ? inlineText(item, feedTitle) : articleText(await fetchText(url, source.allowed_origins));
  return { url, body };
}
