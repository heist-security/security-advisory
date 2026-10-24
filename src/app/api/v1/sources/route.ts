import { sourcePage } from "@/lib/registry";
export async function GET(request: Request) {
  const result = sourcePage(new URL(request.url).searchParams);
  return Response.json(
    {
      schema_version: "1",
      source_count: result.catalog_count,
      channel_counts: result.catalog_channel_counts,
      page: result.page,
      pages: result.pages,
      matching_count: result.total,
      note: "Configured catalog, not live source health. Page size: 24. Filter by q, channel or category; catalog=vendor browses the archived opt-in vendor catalog.",
      data: result.rows.map((s) => ({
        id: s.id,
        name: s.name,
        category: s.category,
        channel: s.channel,
        feed_url: s.feed_url,
        homepage: s.homepage,
        checked_at: s.verification.checked_at || null,
        format: s.id.startsWith("core-") ? "structured" : "rss-atom",
        limitations: s.limitations,
      })),
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    },
  );
}
