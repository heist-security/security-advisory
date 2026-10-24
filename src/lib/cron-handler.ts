import { authorized } from "./cron";
import { failureReason } from "./errors";
export async function runCron(
  request: Request,
  operation: string,
  run: () => Promise<Record<string, number>>,
) {
  const headers = { "Cache-Control": "no-store" };
  if (!authorized(request))
    return Response.json({ error: "Unauthorized" }, { status: 401, headers });
  try {
    const result = await run();
    const failed = (result.failed ?? 0) + (result.failures ?? 0);
    console.info(JSON.stringify({ operation, ...result }));
    return Response.json(result, { status: failed ? 503 : 200, headers });
  } catch (error) {
    const reason = failureReason(error);
    console.error(JSON.stringify({ operation, reason }));
    return Response.json(
      { error: "Collector unavailable", reason },
      { status: 503, headers },
    );
  }
}
