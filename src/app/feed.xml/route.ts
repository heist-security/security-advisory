import { events, rss } from "@/lib/events";
import { baseUrl } from "@/lib/db";
import { cacheHeaders, unavailable } from "@/lib/http";
export async function GET() {
  try { return new Response(rss(await events({ limit: 100 }), baseUrl()), { headers: { ...cacheHeaders, "Content-Type": "application/rss+xml; charset=utf-8" } }); }
  catch { return unavailable(); }
}
