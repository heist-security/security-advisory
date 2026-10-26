import { baseUrl, db } from "./db";
import { advisoryPath } from "./item-links";

// Use the indexed update-ID ranges, not offsets or full advisory payloads.
// Each part contains at most 1,000 current groups, even as the archive grows.
const rangeSize = 1000;
const maxParts = 49_999; // Leave one sitemap-index entry for the main pages.

export async function sitemapParts() {
  const { data, error } = await db().rpc("advisory_sitemap_parts");
  if (error) throw error;
  if (
    !Array.isArray(data) ||
    data.length > maxParts ||
    data.some(
      (part) => !Number.isSafeInteger(part) || part < 0 || part >= maxParts,
    )
  )
    throw new Error("Sitemap index capacity exceeded");
  return ["pages", ...data.map(String)];
}

export function validSitemapPart(part: string) {
  return (
    part === "pages" ||
    (/^(0|[1-9]\d{0,4})$/.test(part) && Number(part) < maxParts)
  );
}

export async function sitemapUrls(part: string) {
  const base = baseUrl();
  if (part === "pages") return [base + "/", base + "/sources", base + "/docs"];
  const urls: string[] = [];
  let cursor = Number(part) * rangeSize;
  const end = cursor + rangeSize;
  // Continue by ID even if PostgREST applies a lower row cap than requested.
  while (cursor < end) {
    const { data, error } = await db()
      .from("advisory_groups")
      .select("id,latest_update_id")
      .eq("active", true)
      .gt("latest_update_id", cursor)
      .lte("latest_update_id", end)
      .order("latest_update_id", { ascending: true })
      .limit(rangeSize);
    if (error) throw error;
    if (!data.length) break;
    const next = Number(data.at(-1)!.latest_update_id);
    if (!Number.isSafeInteger(next) || next <= cursor || next > end)
      throw new Error("Invalid sitemap cursor");
    urls.push(...data.map((row) => base + advisoryPath(row.id)));
    cursor = next;
  }
  return [...new Set(urls)];
}

export function sitemapXml(kind: "sitemapindex" | "urlset", urls: string[]) {
  const tag = kind === "sitemapindex" ? "sitemap" : "url";
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    `<${kind} xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">` +
    urls
      .map(
        (url) =>
          `<${tag}><loc>` +
          url.replace(
            /[<>&"']/g,
            (c) =>
              ({
                "<": "&lt;",
                ">": "&gt;",
                "&": "&amp;",
                '"': "&quot;",
                "'": "&apos;",
              })[c]!,
          ) +
          `</loc></${tag}>`,
      )
      .join("") +
    `</${kind}>`
  );
}
