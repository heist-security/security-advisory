import { authorized } from "@/presentation/cron";
import { services } from "@/server/services";
import { setting } from "@/adapters/environment";
export async function GET(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const data = await services().ingestion.health();
    const maxAge = setting("MAX_QUEUE_AGE_SECONDS", 3600, 60, 604800);
    const degraded =
      !data.migration_ready ||
      !data.structured_sources_configured ||
      data.sources_failing > 0 ||
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
