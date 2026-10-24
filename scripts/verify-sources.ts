import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { sourceSchema, parseFeed, documentText, itemUrl, inlineText, type Source } from "../src/lib/feed";
import { fetchText } from "../src/lib/http";

type Check = { id: string; config_sha256: string; verifier_version: string; checked_at: string; status: "verified" | "rejected"; reason?: string; feed_title?: string; item_count?: number; usable_items?: number; latest_item_at?: string | null; sample_url?: string; sample_characters?: number; sample_sha256?: string; security_mentions_in_window?: number; scope?: string; warnings?: string[] };
const VERSION = "3";
const fingerprint = (source: Source) => createHash("sha256").update(JSON.stringify(source)).digest("hex");
const root = new URL("../", import.meta.url);
const candidates = sourceSchema.array().parse(JSON.parse(await readFile(new URL("sources/candidates.json", root), "utf8")));
const reportPath = new URL("sources/verification.json", root);
const refreshInline = process.argv.includes("--refresh-inline");
const resume = process.argv.includes("--resume") || refreshInline;
const previous: Check[] = resume ? JSON.parse(await readFile(reportPath, "utf8").catch(() => "[]")) : [];
const checks = new Map(previous.map(check => [check.id, check]));
const pending = candidates.filter(source => refreshInline
  ? source.adapter === "feed-content" && checks.get(source.id)?.status === "verified"
  : checks.get(source.id)?.config_sha256 !== fingerprint(source) || checks.get(source.id)?.verifier_version !== VERSION);
let index = 0;
let completed = 0;
const perOrigin = new Map<string, number>();
async function verify(source: Source): Promise<Check> {
  const result: Check = { id: source.id, config_sha256: fingerprint(source), verifier_version: VERSION, checked_at: new Date().toISOString(), status: "rejected" };
  try {
    if (source.exclude_reason) throw new Error(source.exclude_reason);
    const xml = await fetchText(source.feed_url, source.allowed_origins, source.max_feed_bytes);
    const feed = await parseFeed(xml);
    if (!feed.items.length) throw new Error("Empty feed");
    result.feed_title = feed.title; result.item_count = feed.items.length;
    result.latest_item_at = feed.items.map(item => item.isoDate).filter((v): v is string => !!v && Number.isFinite(Date.parse(v))).sort().at(-1) ?? null;
    const items = feed.items.slice(0, 30);
    result.security_mentions_in_window = items.filter(item => /\bCVE-\d{4}|\bGHSA-|\bsecurity\b|vulnerab|\bXSS\b|\bSSRF\b/i.test(`${item.title} ${item.content ?? ""}`)).length;
    let sample: { url: string; body: string } | undefined;
    let usable = 0; const failures: string[] = [];
    for (const item of (source.adapter === "feed-content" ? items : items.slice(0, 3))) {
      try {
        if (source.adapter === "feed-content") {
          const url = itemUrl(source, item); const body = inlineText(item, feed.title); usable++; sample ??= { url, body };
        } else { sample = await documentText(source, item, feed.title); usable++; break; }
      } catch (error) { failures.push(error instanceof Error ? error.message : "Unknown error"); }
    }
    result.usable_items = usable;
    if (!sample) throw new Error(`No usable document: ${[...new Set(failures)].join("; ").slice(0, 250)}`);
    result.sample_url = sample.url; result.sample_characters = sample.body.length;
    result.sample_sha256 = createHash("sha256").update(sample.body).digest("hex");
    result.scope = source.adapter === "feed-content" ? "Parsed feed; validated URLs and inline release notes in up to 30 entries" : "Parsed feed; retrieved and extracted at least one of the first three article links";
    result.warnings = [];
    if (failures.length) result.warnings.push(`${failures.length} checked entries were not usable (${[...new Set(failures)].join("; ").slice(0, 180)})`);
    if (result.latest_item_at && Date.now() - Date.parse(result.latest_item_at) > 365 * 86400000) result.warnings.push("Latest dated entry is older than one year; monitor for source stagnation");
    result.status = "verified";
  } catch (error) { result.reason = error instanceof Error ? error.message.slice(0, 350) : "Unknown verification failure"; }
  return result;
}
async function checkpoint() {
  await writeFile(reportPath, JSON.stringify(candidates.map(source => checks.get(source.id)).filter(Boolean), null, 2) + "\n");
}
async function worker() {
  while (index < pending.length) {
    const source = pending[index++]; const origin = new URL(source.feed_url).origin;
    while ((perOrigin.get(origin) ?? 0) >= 3) await new Promise(resolve => setTimeout(resolve, 100));
    perOrigin.set(origin, (perOrigin.get(origin) ?? 0) + 1);
    const check = await verify(source);
    perOrigin.set(origin, (perOrigin.get(origin) ?? 1) - 1);
    checks.set(source.id, check);
    console.log(`${++completed}/${pending.length} ${check.status} ${source.id}${check.reason ? `: ${check.reason}` : ""}`);
    // One worker writes at a time because the operation is scheduled only after it completes.
    await checkpoint();
  }
}
await mkdir(new URL("sources/", root), { recursive: true });
// Serialize checkpoint writes to avoid partial checkpoint races between verification workers.
let writing = Promise.resolve();
const save = checkpoint;
checkpoint = () => (writing = writing.then(save));
await Promise.all(Array.from({ length: 10 }, worker));
await checkpoint();
const registry = candidates.filter(source => checks.get(source.id)?.status === "verified").map(source => ({ ...source, verification: checks.get(source.id)! }));
await writeFile(new URL("sources/registry.json", root), JSON.stringify(registry, null, 2) + "\n");
console.log(JSON.stringify({ candidates: candidates.length, verified: registry.length, rejected: candidates.length - registry.length }));
