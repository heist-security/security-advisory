import { createHash } from "node:crypto";
import type { SourceRecord } from "./feed-item";
export const digest = (value: unknown) =>
  createHash("sha256")
    .update(
      JSON.stringify(value, (_key, item) =>
        item && typeof item === "object" && !Array.isArray(item)
          ? Object.fromEntries(
              Object.keys(item)
                .sort()
                .map((key) => [key, item[key]]),
            )
          : item,
      ),
    )
    .digest("hex");
export const recordId = (source: string, url: string) => digest([source, url]);
const name = (value: string) => value.trim().replace(/\s+/g, " ").toLowerCase();
export const unique = (values: string[]) => [...new Set(values)].sort();
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" ? (value as Record<string, unknown>) : {};
export function reviewed(record: SourceRecord) {
  return (
    object(record.payload.structured?.provider_metadata).github_reviewed ===
    true
  );
}
export function anchor(record: SourceRecord): string | null {
  const data = record.payload.structured;
  if (record.source_id !== "core-osv" || data?.provider !== "osv") return null;
  const pattern =
    /^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$/;
  if (pattern.test(data.id) && reviewed(record)) return data.id;
  const refs = unique(
    data.references.flatMap((url) => {
      const match = url.match(
        /^https:\/\/github\.com\/(?:[^/]+\/[^/]+\/security\/)?advisories\/(GHSA-[23456789cfghjmpqrvwx-]+)$/,
      );
      return match && pattern.test(match[1]) && data.aliases.includes(match[1])
        ? [match[1]]
        : [];
    }),
  );
  return refs.length === 1 ? refs[0] : null;
}
export function patchKey(record: SourceRecord): string | null {
  const p = record.payload;
  if (p.kind !== "patch" || p.structured || !p.fixed_cves?.length) return null;
  if (
    p.fixed_cves.some(
      (f) =>
        !/^CVE-\d{4}-\d{4,}$/.test(f.cve) ||
        !f.evidence ||
        !p.products.some(
          (product) =>
            product.name.value === f.product && product.fixed_versions.length,
        ),
    )
  )
    return null;
  return (
    "patch:" +
    digest([
      record.source_id,
      unique(p.products.map((p) => name(p.name.value))),
      unique(p.fixed_cves.map((f) => JSON.stringify([name(f.product), f.cve]))),
    ])
  );
}
export const identityKeys = (record: SourceRecord) => [
  "source:" + record.id,
  ...(anchor(record) ? ["osv:" + anchor(record)] : []),
  ...(patchKey(record) ? [patchKey(record)!] : []),
];
/** A shared package needs bounded native data; every shared package must agree. */
export function sameScope(a: SourceRecord, b: SourceRecord) {
  let bounded = false,
    shared = false;
  for (const left of a.payload.structured?.affected ?? [])
    for (const right of b.payload.structured?.affected ?? []) {
      const x = object(left),
        y = object(right),
        xp = object(x.package),
        yp = object(y.package);
      if (
        !xp.name ||
        !xp.ecosystem ||
        xp.name !== yp.name ||
        xp.ecosystem !== yp.ecosystem
      )
        continue;
      shared = true;
      if (
        digest(x.ranges ?? []) !== digest(y.ranges ?? []) ||
        digest(x.versions ?? []) !== digest(y.versions ?? [])
      )
        return false;
      bounded ||=
        (Array.isArray(x.versions) && x.versions.length > 0) ||
        (Array.isArray(x.ranges) &&
          x.ranges.some(
            (r) =>
              Array.isArray(object(r).events) &&
              (object(r).events as unknown[]).some((e) =>
                ["fixed", "last_affected", "limit"].some((k) => k in object(e)),
              ),
          ));
    }
  return shared && bounded;
}
export function itemIdentity(
  record: SourceRecord,
  peers: SourceRecord[],
  previous?: string,
): string {
  if (record.payload.kind === "withdrawal" && previous) return previous;
  const patch = patchKey(record);
  if (patch) return digest(patch);
  const ghsa = anchor(record);
  const primary =
    ghsa && peers.find((p) => p.payload.structured?.id === ghsa && reviewed(p));
  if (
    primary &&
    primary.payload.kind === "withdrawal" &&
    previous === digest("osv:" + ghsa)
  )
    return previous;
  if (
    primary &&
    primary.payload.kind !== "withdrawal" &&
    (primary.id === record.id ||
      (sameScope(record, primary) &&
        !peers.some(
          (p) =>
            p.id !== record.id &&
            anchor(p) === ghsa &&
            p.payload.kind !== "withdrawal" &&
            sameScope(p, primary) &&
            !sameScope(p, record),
        )))
  )
    return digest("osv:" + ghsa);
  return digest("source:" + record.id);
}
