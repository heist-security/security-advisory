import { events } from "@/lib/events";
import { parseEventQuery } from "@/lib/filters";
import { eventHeaders, unavailable } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  let query;
  try {
    query = parseEventQuery(new URL(request.url).searchParams);
  } catch (error) {
    return Response.json(
      { error: (error as Error).message },
      {
        status: 400,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      },
    );
  }
  try {
    const rows = await events(query);
    return Response.json(
      {
        schema_version: "1",
        data: rows,
        next_after: rows.length
          ? Math.max(...rows.map((row) => row.id))
          : (query.after ?? null),
        next_before: rows.length
          ? Math.min(...rows.map((row) => row.id))
          : (query.before ?? null),
      },
      { headers: eventHeaders },
    );
  } catch {
    return unavailable();
  }
}
