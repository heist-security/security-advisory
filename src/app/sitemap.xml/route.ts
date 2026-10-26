import { baseUrl } from "@/lib/db";
import { unavailable } from "@/lib/http";
import {
  sitemapParts,
  sitemapUrls,
  sitemapXml,
  validSitemapPart,
} from "@/lib/sitemap";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const part = params.get("part");
  if (
    [...params.keys()].some((key) => key !== "part") ||
    params.getAll("part").length > 1 ||
    (part !== null && !validSitemapPart(part))
  )
    return new Response("Invalid sitemap part", {
      status: 400,
      headers: { "Cache-Control": "no-store" },
    });
  try {
    const urls =
      part === null
        ? (await sitemapParts()).map(
            (id) => baseUrl() + "/sitemap.xml?part=" + id,
          )
        : await sitemapUrls(part);
    if (!urls.length)
      return new Response("Sitemap part not found", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    const body = sitemapXml(part === null ? "sitemapindex" : "urlset", urls);
    return new Response(body, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control":
          "public, max-age=0, s-maxage=3600, stale-while-revalidate=300",
      },
    });
  } catch {
    return unavailable();
  }
}
