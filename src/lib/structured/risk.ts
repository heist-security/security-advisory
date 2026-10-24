import { z } from "zod";
import { fetchText } from "../http";
import { endpoints } from "./config";
import { kevEntry } from "./normalize";

export function parseRiskQuery(params: URLSearchParams) {
  if (params.getAll("cve").length !== 1 || params.getAll("nvd").length > 1)
    throw new Error("Provide one cve parameter");
  const ids = [
    ...new Set(
      params
        .get("cve")!
        .split(",")
        .map((s) => s.trim().toUpperCase()),
    ),
  ];
  if (
    !ids.length ||
    ids.length > 40 ||
    ids.some((id) => !/^CVE-\d{4}-\d{4,19}$/.test(id))
  )
    throw new Error("Provide 1–40 valid CVE IDs");
  if (params.has("nvd") && params.get("nvd") !== "1")
    throw new Error("nvd must be 1");
  const nvd = params.get("nvd") === "1";
  if (nvd && ids.length !== 1)
    throw new Error("NVD enrichment accepts one CVE per request");
  return { ids: ids.sort(), nvd };
}
const probability = z
  .union([z.number(), z.string().regex(/^(?:0(?:\.\d+)?|1(?:\.0+)?)$/)])
  .transform(Number)
  .pipe(z.number().min(0).max(1));
const epssRow = z.object({
  cve: z.string(),
  epss: probability,
  percentile: probability,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export async function riskContext(ids: string[], includeNvd = false) {
  const result = await Promise.allSettled([
    (async () =>
      z
        .object({ vulnerabilities: z.array(kevEntry) })
        .parse(
          JSON.parse(
            await fetchText(
              endpoints.kev,
              ["https://raw.githubusercontent.com"],
              10_000_000,
            ),
          ),
        ).vulnerabilities)(),
    (async () => {
      const url = new URL(endpoints.epss);
      url.searchParams.set("cve", ids.join(","));
      url.searchParams.set("limit", "100");
      const response = z
        .object({
          status: z.literal("OK"),
          total: z.number(),
          data: z.array(epssRow),
        })
        .parse(JSON.parse(await fetchText(url.toString(), [url.origin])));
      if (
        response.total !== response.data.length ||
        new Set(response.data.map((r) => r.cve)).size !==
          response.data.length ||
        response.data.some((r) => !ids.includes(r.cve))
      )
        throw new Error("Incomplete EPSS response");
      return response.data;
    })(),
    (async () => {
      if (!includeNvd) return null;
      const url = new URL(endpoints.nvd);
      url.searchParams.set("cveId", ids[0]);
      const response = z
        .object({
          vulnerabilities: z.array(
            z.object({
              cve: z.object({
                id: z.string(),
                lastModified: z.string(),
                vulnStatus: z.string(),
                metrics: z.unknown().optional(),
                configurations: z.unknown().optional(),
                weaknesses: z.unknown().optional(),
              }),
            }),
          ),
        })
        .parse(
          JSON.parse(await fetchText(url.toString(), [url.origin], 4_000_000)),
        );
      if (response.vulnerabilities.some((r) => r.cve.id !== ids[0]))
        throw new Error("NVD identity mismatch");
      return response.vulnerabilities[0]?.cve ?? null;
    })(),
  ]);
  const [kev, epss, nvd] = result;
  const availability = {
    kev: kev.status === "fulfilled" ? "available" : "unavailable",
    epss: epss.status === "fulfilled" ? "available" : "unavailable",
    nvd: !includeNvd
      ? "not_requested"
      : nvd.status === "fulfilled"
        ? "available"
        : "unavailable",
  };
  return {
    availability,
    data: ids.map((id) => ({
      cve: id,
      kev:
        kev.status === "fulfilled"
          ? (kev.value.find((r) => r.cveID === id) ?? null)
          : null,
      epss:
        epss.status === "fulfilled"
          ? (epss.value.find((r) => r.cve === id) ?? null)
          : null,
      ...(includeNvd
        ? { nvd: nvd.status === "fulfilled" ? nvd.value : null }
        : {}),
    })),
  };
}
