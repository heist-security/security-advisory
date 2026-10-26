import { unstable_cache } from "next/cache";
import { parseRiskQuery, riskContext } from "@/adapters/risk/provider";
import { cacheHeaders } from "@/presentation/http";
const context = unstable_cache(riskContext, ["vulnerability-risk-v1"], {
  revalidate: 900,
});
export async function GET(request: Request) {
  let query: ReturnType<typeof parseRiskQuery>;
  try {
    query = parseRiskQuery(new URL(request.url).searchParams);
  } catch {
    return Response.json(
      {
        error:
          "Provide 1–40 comma-separated CVE IDs in cve. Optional nvd=1 accepts one CVE.",
      },
      { status: 400, headers: { "Access-Control-Allow-Origin": "*" } },
    );
  }
  const result = await context(query.ids, query.nvd);
  const unavailable = Object.values(result.availability).every(
    (s) => s !== "available",
  );
  return Response.json(
    {
      schema_version: "1",
      ...result,
      note: "Null means no returned record or unavailable data, not zero risk. EPSS is a global exploitation forecast, not a probability that your system will be compromised. KEV absence is not proof of no exploitation. NVD enrichment does not gate publication.",
    },
    {
      status: unavailable ? 503 : 200,
      headers: {
        ...cacheHeaders,
        ...(unavailable
          ? { "Cache-Control": "no-store", "Retry-After": "60" }
          : {}),
      },
    },
  );
}
