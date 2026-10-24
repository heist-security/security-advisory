import { authorized } from "@/lib/cron";
import { poll } from "@/lib/ingest";
export const maxDuration = 300;
export async function GET(request: Request) {
  if (!authorized(request)) return Response.json({ error: "Unauthorized" }, { status: 401 });
  try { return Response.json(await poll(), { headers: { "Cache-Control": "no-store" } }); }
  catch { console.error("Source poll failed"); return Response.json({ error: "Poll failed" }, { status: 500 }); }
}
