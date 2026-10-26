import { z } from "zod";
import {
  extractionSchema,
  type Extraction,
  type StructuredPayload,
} from "../../../domain/evidence";
import { cleanText } from "../publisher";
import type { StructuredId } from "./config";
import { osvSeverity } from "./severity";

const text = z.string();
const object = z.record(z.string(), z.unknown());
const cveId = /^CVE-\d{4}-\d{4,}$/;
const date = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid timestamp");
const osv = z.object({
  id: text.regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/),
  modified: date,
  published: date.optional(),
  withdrawn: date.optional(),
  aliases: z.array(text).default([]),
  upstream: z.array(text).optional(),
  summary: text.optional(),
  details: text.optional(),
  affected: z
    .array(
      z
        .object({
          package: z
            .object({ name: text, ecosystem: text, purl: text.optional() })
            .optional(),
          ranges: z.array(object).optional(),
          versions: z.array(text).optional(),
        })
        .passthrough(),
    )
    .default([]),
  references: z.array(z.object({ url: text })).default([]),
  database_specific: object.optional(),
  severity: z.array(object).optional(),
});
const cve = z.object({
  dataType: z.literal("CVE_RECORD"),
  cveMetadata: z.object({
    cveId: text.regex(cveId),
    state: z.enum(["PUBLISHED", "REJECTED"]),
    dateUpdated: date,
    datePublished: date.optional(),
  }),
  containers: z.object({
    cna: z
      .object({
        title: text.optional(),
        descriptions: z
          .array(z.object({ lang: text, value: text }))
          .default([]),
        rejectedReasons: z
          .array(z.object({ lang: text, value: text }))
          .default([]),
        affected: z.array(object).default([]),
        references: z.array(z.object({ url: text })).default([]),
        metrics: z.array(object).default([]),
        providerMetadata: object.optional(),
      })
      .passthrough(),
    adp: z.array(object).optional(),
  }),
});
export const kevEntry = z.object({
  cveID: text.regex(cveId),
  vendorProject: text,
  product: text,
  vulnerabilityName: text,
  shortDescription: text,
  dateAdded: text.regex(/^\d{4}-\d{2}-\d{2}$/),
  requiredAction: text,
  dueDate: text,
  knownRansomwareCampaignUse: text,
  notes: text.optional(),
  cwes: z.array(text).optional(),
});
export const structuredPayloadSchema = extractionSchema.extend({
  products: z.array(extractionSchema.shape.products.element),
  related_cves: z.array(extractionSchema.shape.related_cves.element),
  structured: z.object({
    provider: z.enum(["osv", "cve", "kev"]),
    id: text,
    modified: date,
    aliases: z.array(text),
    upstream: z.array(text).optional(),
    affected: z.array(z.unknown()),
    references: z.array(text),
    metrics: z.array(z.unknown()).optional(),
    provider_metadata: z.unknown().optional(),
    exploitation: z.unknown().optional(),
  }),
});
export type Normalized = {
  payload: StructuredPayload;
  published: string | null;
  url: string;
};
const fact = (value: string, pointer: string) => ({ value, evidence: pointer });
const refs = (values: { url: string }[]) => [
  ...new Set(
    values
      .map((v) => v.url)
      .filter((url) => {
        try {
          const u = new URL(url);
          return u.protocol === "https:" && !u.username && !u.password;
        } catch {
          return false;
        }
      }),
  ),
];
function severity(value: unknown): Extraction["severity"] {
  const v = typeof value === "string" ? value.toLowerCase() : "unknown";
  return ["critical", "high", "medium", "low"].includes(v)
    ? (v as Extraction["severity"])
    : "unknown";
}
function base(
  provider: "osv" | "cve" | "kev",
  id: string,
  modified: string,
  title: string,
  summary: string,
): StructuredPayload {
  return {
    security_relevant: true,
    kind: "advisory",
    title: cleanText(title).slice(0, 200),
    summary: cleanText(summary).slice(0, 1500),
    evidence: `${provider}:${id}`,
    products: [],
    related_cves: [],
    severity: "unknown",
    severity_evidence: null,
    structured: {
      provider,
      id,
      modified,
      aliases: [id],
      affected: [],
      references: [],
    },
  };
}
export function normalizeRecord(
  source: StructuredId,
  raw: unknown,
): Normalized {
  if (source === "core-osv") {
    const r = osv.parse(raw);
    const p = base(
      "osv",
      r.id,
      r.modified,
      r.summary || r.id,
      r.details || r.summary || r.id,
    );
    p.kind = r.withdrawn ? "withdrawal" : "advisory";
    p.structured.aliases = [...new Set([r.id, ...r.aliases])].sort();
    p.related_cves = p.structured.aliases
      .filter((id) => cveId.test(id))
      .map((id) => fact(id, id === r.id ? "/id" : "/aliases"));
    // Upstream vulnerabilities are directional relationships, not aliases of
    // this distribution/package advisory (and must not become grouping keys).
    if (r.upstream) {
      p.structured.upstream = [...new Set(r.upstream)].sort();
      const linked = new Set(p.related_cves.map((c) => c.value));
      p.related_cves.push(
        ...p.structured.upstream
          .filter((id) => cveId.test(id) && !linked.has(id))
          .map((id) => fact(id, "/upstream")),
      );
    }
    p.structured.affected = r.affected;
    p.structured.references = refs(r.references);
    p.structured.metrics = r.severity;
    p.structured.provider_metadata = r.database_specific;
    p.severity = severity(r.database_specific?.severity);
    if (p.severity !== "unknown")
      p.severity_evidence = "/database_specific/severity";
    else {
      const rating = osvSeverity(r.severity ?? []);
      if (rating) {
        p.severity = rating.severity;
        p.severity_evidence = `/severity/${rating.index}/score`;
      }
    }
    p.products = r.affected.flatMap((a, index) =>
      a.package
        ? [
            {
              name: fact(a.package!.name, `/affected/${index}/package/name`),
              // Native ranges (including ecosystem and Git semantics) remain in structured.affected.
              affected_versions: (a.versions ?? []).map((v) =>
                fact(v, `/affected/${index}/versions`),
              ),
              fixed_versions: (a.ranges ?? [])
                .filter((range) => range.type !== "GIT")
                .flatMap((range) =>
                  z
                    .array(object)
                    .parse(range.events ?? [])
                    .flatMap((event) =>
                      typeof event.fixed === "string"
                        ? [fact(event.fixed, `/affected/${index}/ranges`)]
                        : [],
                    ),
                ),
              prerequisites: [],
            },
          ]
        : [],
    );
    return checked({
      payload: p,
      published: r.published ?? null,
      url: `https://osv.dev/vulnerability/${encodeURIComponent(r.id)}`,
    });
  }
  if (source === "core-cve") {
    const r = cve.parse(raw),
      c = r.containers.cna,
      id = r.cveMetadata.cveId;
    const description =
      r.cveMetadata.state === "REJECTED" ? c.rejectedReasons : c.descriptions;
    const p = base(
      "cve",
      id,
      r.cveMetadata.dateUpdated,
      c.title || id,
      (description.find((d) => d.lang === "en") ?? description[0])?.value || id,
    );
    p.kind = r.cveMetadata.state === "REJECTED" ? "withdrawal" : "advisory";
    p.related_cves = [fact(id, "/cveMetadata/cveId")];
    p.structured.affected = c.affected;
    p.structured.references = refs(c.references);
    p.structured.metrics = c.metrics;
    p.structured.provider_metadata = {
      cna: c.providerMetadata,
      adp: r.containers.adp,
    };
    p.products = c.affected.flatMap((a, index) =>
      typeof a.product === "string"
        ? [
            {
              name: fact(
                a.product,
                `/containers/cna/affected/${index}/product`,
              ),
              // Do not turn an unaffected version, upper bound, or backport into an invented fixed release.
              affected_versions: [],
              fixed_versions: [],
              prerequisites: [],
            },
          ]
        : [],
    );
    const ratings = c.metrics.flatMap((m) =>
      Object.values(m).flatMap((v) =>
        v && typeof v === "object" && "baseSeverity" in v
          ? [severity(v.baseSeverity)]
          : [],
      ),
    );
    p.severity =
      (["critical", "high", "medium", "low"] as const).find((s) =>
        ratings.includes(s),
      ) ?? "unknown";
    if (p.severity !== "unknown")
      p.severity_evidence = "/containers/cna/metrics";
    return checked({
      payload: p,
      published: r.cveMetadata.datePublished ?? null,
      url: `https://www.cve.org/CVERecord?id=${id}`,
    });
  }
  const removal = z
    .object({
      removed: z.literal(true),
      cveID: text.regex(cveId),
      removedAt: date,
    })
    .safeParse(raw);
  if (removal.success) {
    const r = removal.data;
    const p = base(
      "kev",
      r.cveID,
      r.removedAt,
      `${r.cveID} removed from CISA KEV`,
      "CISA removed this entry from its catalog. This does not establish that exploitation did not occur or that affected systems are safe.",
    );
    p.kind = "withdrawal";
    p.related_cves = [fact(r.cveID, "/cveID")];
    p.structured.exploitation = { catalog_membership: "removed" };
    return checked({
      payload: p,
      published: r.removedAt,
      url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${r.cveID}`,
    });
  }
  const r = kevEntry.parse(raw);
  const p = base(
    "kev",
    r.cveID,
    r.dateAdded + "T00:00:00.000Z",
    r.vulnerabilityName,
    `${r.shortDescription}\nCISA required action: ${r.requiredAction}`,
  );
  p.related_cves = [fact(r.cveID, "/cveID")];
  p.products = [
    {
      name: fact(r.product, "/product"),
      affected_versions: [],
      fixed_versions: [],
      prerequisites: [],
    },
  ];
  p.structured.exploitation = { known_exploited: true, ...r };
  p.structured.references = [
    "https://www.cisa.gov/known-exploited-vulnerabilities-catalog",
  ];
  return checked({
    payload: p,
    published: p.structured.modified,
    url: `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${r.cveID}`,
  });
}
function checked(result: Normalized): Normalized {
  result.payload = structuredPayloadSchema.parse(result.payload);
  // The existing document queue has a 50,000-character limit. Fail visibly, never silently drop ranges.
  if (JSON.stringify(result).length > 49_000)
    throw new Error("Structured record exceeds document byte limit");
  return result;
}

export type { StructuredPayload } from "../../../domain/evidence";
