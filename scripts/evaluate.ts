import { readFile, writeFile } from "node:fs/promises";
type Case = {
  id: string;
  text: string;
  expected: {
    security_relevant: boolean;
    kind?: string;
    product?: string;
    fixed_version?: string;
    cves?: string[];
    severity?: string;
  };
};
if (!process.argv.includes("--allow-paid"))
  throw new Error(
    "Live evaluation spends provider credits. Pass --allow-paid to proceed.",
  );
if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL)
  throw new Error("Set OPENAI_API_KEY and OPENAI_MODEL");
const path =
  process.argv.find((v) => v.startsWith("--fixtures="))?.slice(11) ??
  new URL("../tests/fixtures/extraction.json", import.meta.url);
const cases: Case[] = JSON.parse(await readFile(path, "utf8"));
if (process.argv.includes("--launch") && cases.length < 100)
  throw new Error("Launch evaluation requires at least 100 reviewed cases.");
const { extract } = await import("../src/lib/extract");
const results = [];
for (const item of cases) {
  try {
    const output = await extract(item.text);
    const failures: string[] = [];
    if (output.security_relevant !== item.expected.security_relevant)
      failures.push("relevance");
    if (item.expected.kind && output.kind !== item.expected.kind)
      failures.push("kind");
    const product = item.expected.product
      ? output.products.find((p) => p.name.value === item.expected.product)
      : undefined;
    if (item.expected.product && !product) failures.push("product");
    if (
      item.expected.fixed_version &&
      !product?.fixed_versions.some(
        (v) => v.value === item.expected.fixed_version,
      )
    )
      failures.push("product_fixed_version");
    if (
      item.expected.cves &&
      JSON.stringify(output.related_cves.map((c) => c.value).sort()) !==
        JSON.stringify([...item.expected.cves].sort())
    )
      failures.push("cves");
    if (item.expected.severity && output.severity !== item.expected.severity)
      failures.push("severity");
    results.push({
      id: item.id,
      passed: failures.length === 0,
      failures,
      output,
    });
  } catch {
    results.push({
      id: item.id,
      passed: false,
      failures: ["extraction_or_validation_failed"],
    });
  }
}
const report = {
  model: process.env.OPENAI_MODEL,
  at: new Date().toISOString(),
  fixtures: cases.length,
  passed: results.filter((r) => r.passed).length,
  results,
};
await writeFile(
  "evaluation-results.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(
  JSON.stringify({
    model: report.model,
    fixtures: report.fixtures,
    passed: report.passed,
  }),
);
if (report.passed !== cases.length) process.exitCode = 1;
