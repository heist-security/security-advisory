import { services } from "@/server/services";
import { parseFeedQuery } from "@/presentation/filters";
import { feedHeaders, unavailable } from "@/presentation/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let query;
  try {
    query = parseFeedQuery(new URL(request.url).searchParams);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      { status: 400, headers: feedHeaders },
    );
  }
  try {
    const rows = await services().feed.list(query);
    return Response.json(
      {
        schema_version: "1",
        data: rows,
        next_after: rows.length
          ? Math.max(...rows.map((r) => r.cursor))
          : (query.after ?? null),
        next_before: rows.length
          ? Math.min(...rows.map((r) => r.cursor))
          : null,
      },
      { headers: feedHeaders },
    );
  } catch {
    return unavailable();
  }
}
