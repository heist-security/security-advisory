import { events } from "@/lib/events";
import { cacheHeaders, unavailable } from "@/lib/http";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const after = params.has("after") ? Number(params.get("after")) : undefined;
  const limit = Number(params.get("limit") ?? 30);
  const kind = params.get("kind") ?? undefined; const cve = params.get("cve") ?? undefined;
  if ((after !== undefined && (!Number.isSafeInteger(after) || after < 0)) || !Number.isInteger(limit) || limit < 1 || limit > 100 || (kind && !["advisory", "patch", "mitigation", "withdrawal", "other"].includes(kind)) || (cve && !/^CVE-\d{4}-\d{4,}$/.test(cve))) {
    return Response.json({ error: "Invalid after, limit, kind or cve parameter" }, { status: 400, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  try {
    const rows = await events({ after, limit, kind, cve });
    return Response.json({ schema_version: "1", data: rows, next_after: rows.length ? Math.max(...rows.map(row => row.id)) : after ?? null }, { headers: cacheHeaders });
  } catch { return unavailable(); }
}
