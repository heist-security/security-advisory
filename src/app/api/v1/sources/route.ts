import { sourcePage, registry, channelCounts } from "@/lib/registry";
export async function GET(request: Request) {
  const result = sourcePage(new URL(request.url).searchParams);
  return Response.json({
    schema_version: "1", source_count: registry.length, channel_counts: channelCounts,
    page: result.page, pages: result.pages, matching_count: result.total,
    note: "Catalog snapshot, not live source health. Page size: 24. Filter by q, channel or category.",
    data: result.rows.map(s => ({ id: s.id, name: s.name, category: s.category, channel: s.channel, feed_url: s.feed_url, homepage: s.homepage, checked_at: s.verification.checked_at, limitations: s.limitations })),
  }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
