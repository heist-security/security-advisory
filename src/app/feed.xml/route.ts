import { services, baseUrl } from "@/server/services";
import { parseFeedQuery, filterQuery } from "@/presentation/filters";
import { rss } from "@/presentation/rss";
import { feedHeaders, unavailable } from "@/presentation/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let query;
  try {
    query = parseFeedQuery(new URL(request.url).searchParams, 100);
    if (query.after !== undefined || query.before !== undefined)
      throw new Error("Use JSON for cursors");
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400, headers: feedHeaders },
    );
  }
  try {
    const rows = await services().feed.list(query, true);
    const filters = filterQuery(query);
    return new Response(
      rss(
        rows,
        baseUrl(),
        baseUrl() + "/feed.xml" + (filters.size ? "?" + filters : ""),
      ),
      {
        headers: {
          ...feedHeaders,
          "Content-Type": "application/rss+xml; charset=utf-8",
        },
      },
    );
  } catch {
    return unavailable();
  }
}
