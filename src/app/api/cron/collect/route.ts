import { collect } from "@/lib/ingest";
import { runCron } from "@/lib/cron-handler";
export const maxDuration = 300;
export async function GET(request: Request) {
  return runCron(request, "collect", collect);
}
