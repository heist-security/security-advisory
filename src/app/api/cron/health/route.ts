import { authorized } from "@/lib/cron";
import { db } from "@/lib/db";
import { setting } from "@/lib/config";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const { data, error } = await db().rpc("feed_health");
    if (error) throw error;
    const maxAge = setting("MAX_QUEUE_AGE_SECONDS", 3600, 60, 604800);
    const degraded =
      data.sources_overdue > 0 ||
      data.collection_failed > 0 ||
      data.extraction_failed > 0 ||
      data.collection_oldest_seconds > maxAge ||
      data.extraction_oldest_seconds > maxAge;
    return Response.json(
      { status: degraded ? "degraded" : "ok", ...data },
      { status: degraded ? 503 : 200, headers },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
