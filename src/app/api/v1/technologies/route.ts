import { services } from "@/server/services";
import { technologyKey } from "@/presentation/filters";
import { feedHeaders, unavailable } from "@/presentation/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const after = params.get("after") ?? undefined;
  const rawLimit = params.get("limit") ?? "20";
  const limit = Number(rawLimit);
  if (
    [...params.keys()].some(
      (key) =>
        !["q", "after", "limit"].includes(key) || params.getAll(key).length > 1,
    ) ||
    q.length > 100 ||
    (q && !technologyKey(q)) ||
    (after !== undefined &&
      (after.length > 100 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(after))) ||
    !/^\d{1,3}$/.test(rawLimit) ||
    limit < 1 ||
    limit > 100
  )
    return Response.json(
      { error: "Invalid technology search" },
      { status: 400, headers: feedHeaders },
    );
  try {
    const page = await services().feed.technologies({ q, after, limit });
    return Response.json(page, { headers: feedHeaders });
  } catch {
    return unavailable();
  }
}
