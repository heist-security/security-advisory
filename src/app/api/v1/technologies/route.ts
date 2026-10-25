import { db } from "@/lib/db";
import { technologyKey } from "@/lib/filters";
import { technologyOptions } from "@/lib/technology-options";
import { eventHeaders, unavailable } from "@/lib/http";
import { technologySearch } from "@/lib/technology";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (
    params.getAll("q").length > 1 ||
    q.length > 100 ||
    (q && !technologyKey(q))
  )
    return Response.json(
      { error: "Invalid technology search" },
      { status: 400, headers: eventHeaders },
    );
  try {
    let query = db()
      .from("events")
      .select("technologies,products:payload->products")
      .limit(100);
    // Search indexed public event text, then return only matching routing keys.
    // The bounded suggestion list is not an exhaustive technology catalog.
    if (q)
      query = query
        .textSearch("search_document", technologySearch(q), {
          config: "simple",
        })
        .order("technologies", { ascending: true });
    // A technology sort avoids the event-ID/limit plan that scans unrelated
    // recent events for rare prefixes. Labels are sorted for display below.
    // Only the unfiltered initial list needs recent-event ordering.
    else query = query.order("id", { ascending: false });
    const { data, error } = await query;
    if (error) throw error;
    return Response.json(
      { data: technologyOptions(data ?? [], q) },
      { headers: eventHeaders },
    );
  } catch {
    return unavailable();
  }
}
