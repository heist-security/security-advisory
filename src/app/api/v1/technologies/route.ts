import { services } from "@/server/services";
import { technologyKey } from "@/presentation/filters";
import { feedHeaders, unavailable } from "@/presentation/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  if (
    [...params.keys()].some((key) => key !== "q") ||
    params.getAll("q").length > 1 ||
    q.length > 100 ||
    (q && !technologyKey(q))
  )
    return Response.json(
      { error: "Invalid technology search" },
      { status: 400, headers: feedHeaders },
    );
  try {
    const data = await services().feed.technologies(q);
    return Response.json({ data: data ?? [] }, { headers: feedHeaders });
  } catch {
    return unavailable();
  }
}
