import { authorized } from "@/lib/cron";
import { db } from "@/lib/db";
import { setting } from "@/lib/config";
import { structuredIds } from "@/lib/structured/config";
import { syncStateSchema } from "@/lib/structured/discover";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const { data, error } = await db().rpc("feed_health");
    if (error) throw error;
    const sources = await db()
      .from("sources")
      .select("id,enabled,verification")
      .in("id", [...structuredIds]);
    if (sources.error) throw sources.error;
    const structuredReady = structuredIds.every((id) =>
      sources.data?.some(
        (s) =>
          s.id === id &&
          s.enabled &&
          syncStateSchema.safeParse(s.verification?.sync).success,
      ),
    );
    const maxAge = setting("MAX_QUEUE_AGE_SECONDS", 3600, 60, 604800);
    const degraded =
      !structuredReady ||
      data.sources_failing > 0 ||
      data.sources_overdue > 0 ||
      data.collection_failed > 0 ||
      data.extraction_failed > 0 ||
      data.collection_oldest_seconds > maxAge ||
      data.extraction_oldest_seconds > maxAge;
    return Response.json(
      {
        status: degraded ? "degraded" : "ok",
        ...data,
        structured_sources_configured: structuredReady,
      },
      { status: degraded ? 503 : 200, headers },
    );
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503, headers });
  }
}
