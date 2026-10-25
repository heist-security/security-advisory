import { catalogOptions } from "@/lib/technology-catalog";
import { technologyKey } from "@/lib/filters";
import { eventHeaders, unavailable } from "@/lib/http";
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
    const data = await catalogOptions(q);
    return Response.json({ data: data ?? [] }, { headers: eventHeaders });
  } catch {
    return unavailable();
  }
}
