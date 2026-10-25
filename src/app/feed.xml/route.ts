import { events, rss } from "@/lib/events";
import { baseUrl } from "@/lib/db";
import { parseEventQuery, filterQuery } from "@/lib/filters";
import { eventHeaders, unavailable } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let query;
  try {
    const params = new URL(request.url).searchParams;
    if (params.has("after") || params.has("before"))
      throw new Error("Use the JSON API for cursor pagination");
    query = parseEventQuery(params, 100);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }
  try {
    const params = filterQuery(query);
    if (query.limit !== 100) params.set("limit", String(query.limit));
    const self = baseUrl() + "/feed.xml" + (params.size ? "?" + params : "");
    return new Response(rss(await events(query), baseUrl(), self), {
      headers: {
        ...eventHeaders,
        "Content-Type": "application/rss+xml; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return unavailable();
  }
}
