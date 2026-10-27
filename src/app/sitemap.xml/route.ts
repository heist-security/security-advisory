import { baseUrl, services } from "@/server/services";
import { unavailable } from "@/presentation/http";
import { sitemapXml, validSitemapPart } from "@/presentation/sitemap";

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
        ? [...new Set([0, ...(await services().feed.sitemapParts())])].map(
            (id) => baseUrl() + "/sitemap.xml?part=" + id,
          )
        : [
            ...(part === "0"
              ? [baseUrl() + "/", baseUrl() + "/sources", baseUrl() + "/docs"]
              : []),
            ...(
              await services().feed.sitemapItems(
                Number(part) * 1000,
                (Number(part) + 1) * 1000,
              )
            ).map((item) => baseUrl() + "/items/" + item.id),
          ];
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
