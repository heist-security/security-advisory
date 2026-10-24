import { registry, channelCounts } from "@/lib/registry";
export async function GET() {
  return Response.json({
    schema_version: "1", source_count: registry.length, channel_counts: channelCounts,
    note: "Configured source catalog. Verification checks feed parsing and a usable document; it is not a live uptime or LLM accuracy guarantee.",
    data: registry,
  }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } });
}
