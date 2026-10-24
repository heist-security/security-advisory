import { authorized } from "@/lib/cron";
import { processJobs } from "@/lib/ingest";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await processJobs(), { headers: { "Cache-Control": "no-store" } }); }
  catch { console.error("Extraction worker failed"); return Response.json({ error: "Processing failed" }, { status: 500 }); }
}
