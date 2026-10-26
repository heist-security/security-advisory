import { services } from "@/server/services";
import { runCron } from "@/presentation/cron-handler";
export const maxDuration = 300;
export async function GET(request: Request) {
  return runCron(request, "process", () => services().ingestion.process());
}
