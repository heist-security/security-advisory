import { z } from "zod";

const fact = z.object({
  value: z.string().min(1).max(500),
  evidence: z.string().min(1).max(1000),
});
export const extractionSchema = z.object({
  security_relevant: z.boolean(),
  kind: z.enum(["advisory", "patch", "mitigation", "withdrawal", "other"]),
  title: z.string().max(200),
  summary: z.string().max(1500),
  evidence: z.string().max(1000),
  products: z
    .array(
      z.object({
        name: fact,
        affected_versions: z.array(fact).max(30),
        fixed_versions: z.array(fact).max(30),
        prerequisites: z.array(fact).max(20),
      }),
    )
    .max(30),
  related_cves: z.array(fact).max(50),
  severity: z.enum(["critical", "high", "medium", "low", "unknown"]),
  severity_evidence: z.string().max(1000).nullable(),
});
export type Extraction = z.infer<typeof extractionSchema>;
export function validateEvidence(data: Extraction, text: string): Extraction {
  data = extractionSchema.parse(data);
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  const source = normalize(text);
  const check = (quote: string) => {
    if (!normalize(quote) || !source.includes(normalize(quote)))
      throw new Error("Evidence not found in source");
  };
  if (!data.security_relevant) return data;
  if (
    !normalize(data.title) ||
    !normalize(data.summary) ||
    !data.products.length
  )
    throw new Error("Incomplete security extraction");
  check(data.evidence);
  for (const product of data.products) {
    for (const item of [
      product.name,
      ...product.affected_versions,
      ...product.fixed_versions,
      ...product.prerequisites,
    ]) {
      if (!normalize(item.value)) throw new Error("Fact must not be empty");
      check(item.evidence);
      if (!normalize(item.evidence).includes(normalize(item.value)))
        throw new Error("Fact absent from evidence");
    }
  }
  for (const cve of data.related_cves) {
    if (!/^CVE-\d{4}-\d{4,}$/.test(cve.value)) throw new Error("Invalid CVE");
    check(cve.evidence);
    if (!cve.evidence.includes(cve.value))
      throw new Error("CVE absent from evidence");
  }
  if (data.severity !== "unknown") {
    check(data.severity_evidence ?? "");
    const label = data.severity;
    const evidence = normalize(data.severity_evidence ?? "").toLowerCase();
    const rating = new RegExp(
      "(?:severity|risk|impact|rating)\\s*(?:level\\s*)?[:=\\-]?\\s*" +
        label +
        "\\b|\\b" +
        label +
        "\\s+(?:severity|risk|impact|rating)\\b",
    );
    if (
      !rating.test(evidence) ||
      new RegExp("\\b(?:not|non)[ -]?" + label + "\\b").test(evidence)
    )
      throw new Error("Severity must be explicitly stated with a rating label");
  }
  if (
    data.kind === "patch" &&
    !data.products.some((p) => p.fixed_versions.length)
  )
    throw new Error("Patch without fixed version");
  return data;
}
