import { z } from "zod";
import { fetchText } from "../http";
import { endpoints, type StructuredId } from "./config";
import { kevEntry } from "./normalize";

const timestamp = z
  .string()
  .refine((v) => Number.isFinite(Date.parse(v)), "Invalid cursor timestamp");
export const syncStateSchema = z.object({
  since: timestamp,
  until: timestamp.optional(),
  after: z.string().optional(),
  // Reviewed, immutable delta snapshot for an initial import outside live history.
  cve_bootstrap_ref: z
    .string()
    .regex(/^[a-f0-9]{40}$/)
    .optional(),
  kev_ids: z.array(z.string().regex(/^CVE-\d{4}-\d{4,}$/)).optional(),
});
export type SyncState = z.infer<typeof syncStateSchema>;
export type RecordItem = {
  structured: {
    id: string;
    modified: string;
    record?: unknown;
    removed?: boolean;
  };
  link: string;
  isoDate: string;
};
export type Discovery = {
  items: RecordItem[];
  state: SyncState;
  more: boolean;
};
const iso = (v: string) => new Date(v).toISOString();
const key = (r: RecordItem) =>
  iso(r.structured.modified) + "|" + r.structured.id;
const cvePattern = /^CVE-(\d{4})-(\d{4,})$/;
export function recordUrl(source: StructuredId, id: string) {
  if (source === "core-osv") {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]*$/.test(id))
      throw new Error("Invalid OSV ID");
    return `https://api.osv.dev/v1/vulns/${encodeURIComponent(id)}`;
  }
  const match = cvePattern.exec(id);
  if (!match) throw new Error("Invalid CVE ID");
  return `https://raw.githubusercontent.com/CVEProject/cvelistV5/main/cves/${match[1]}/${match[2].slice(0, -3)}xxx/${id}.json`;
}
export function sourceUrl(source: StructuredId, id: string) {
  if (source === "core-osv")
    return `https://osv.dev/vulnerability/${encodeURIComponent(id)}`;
  if (source === "core-cve") return `https://www.cve.org/CVERecord?id=${id}`;
  return `https://www.cisa.gov/known-exploited-vulnerabilities-catalog?search_api_fulltext=${id}`;
}
function item(source: StructuredId, id: string, modified: string): RecordItem {
  recordUrl(source, id); // Validate identifiers before constructing any URL.
  return {
    structured: { id, modified: iso(modified) },
    link: sourceUrl(source, id),
    isoDate: iso(modified),
  };
}
export function page(
  items: RecordItem[],
  state: SyncState,
  until: string,
  limit: number,
): Discovery {
  const unique = new Map<string, RecordItem>();
  for (const r of items) {
    if (Date.parse(r.structured.modified) > Date.parse(until)) continue;
    const previous = unique.get(r.structured.id);
    if (!previous || key(r) > key(previous)) unique.set(r.structured.id, r);
  }
  const sorted = [...unique.values()]
    .filter(
      (r) =>
        (!state.after || key(r) > state.after) &&
        Date.parse(r.structured.modified) >= Date.parse(state.since) - 300000,
    )
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const selected = sorted.slice(0, limit),
    more = sorted.length > selected.length;
  return {
    items: selected,
    more,
    state: more
      ? { ...state, until, after: key(selected.at(-1)!) }
      : { since: until },
  };
}
// Read only the recent prefix. Cancel the stream once the checkpoint is reached.
// No full-database ZIP is downloaded by a serverless invocation.
export async function osvChanges(since: string): Promise<RecordItem[]> {
  const response = await fetch(endpoints.osv, {
    redirect: "error",
    signal: AbortSignal.timeout(60000),
  });
  if (!response.ok || !response.body) throw new Error("OSV index unavailable");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  const rows: RecordItem[] = [];
  let bytes = 0,
    pending = "",
    previous = Infinity;
  const accept = (line: string) => {
    if (!line.trim()) return true;
    const comma = line.indexOf(",");
    const modified = line.slice(0, comma),
      path = line.slice(comma + 1).trim();
    const time = Date.parse(modified);
    if (comma < 0 || !Number.isFinite(time) || time > previous)
      throw new Error("Invalid OSV index ordering");
    previous = time;
    if (time < Date.parse(since) - 300000) return false;
    const id = path.slice(path.lastIndexOf("/") + 1).replace(/\.json$/, "");
    rows.push(item("core-osv", id, modified));
    if (rows.length > 200000)
      throw new Error(
        "Structured index exceeds entry limit; explicit backfill required",
      );
    return true;
  };
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        pending += decoder.decode();
        if (pending) accept(pending);
        break;
      }
      bytes += value.length;
      if (bytes > 64_000_000)
        throw new Error(
          "Structured index exceeds byte limit; explicit backfill required",
        );
      pending += decoder.decode(value, { stream: true });
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        if (!accept(line)) return rows;
      }
      if (pending.length > 4096) throw new Error("Invalid OSV index line");
    }
    return rows;
  } finally {
    await reader.cancel().catch(() => {});
  }
}
export function cveChanges(raw: unknown, since: string) {
  const change = z.object({
    cveId: z.string().regex(cvePattern),
    dateUpdated: timestamp,
  });
  const logs = z
    .array(
      z.object({
        fetchTime: timestamp,
        new: z.array(change),
        updated: z.array(change),
        error: z.array(z.unknown()).default([]),
      }),
    )
    .min(1)
    .parse(raw);
  const oldest = Math.min(...logs.map((log) => Date.parse(log.fetchTime)));
  // Never reset a stale checkpoint to "now": that would silently lose an outage window.
  if (Date.parse(since) < oldest)
    throw new Error(
      "CVE checkpoint outside delta history; explicit backfill required",
    );
  const result: RecordItem[] = [];
  for (const log of logs) {
    if (Date.parse(log.fetchTime) < Date.parse(since) - 300000) continue;
    if (log.error.length) throw new Error("CVE upstream delta contains errors");
    for (const entry of [...log.new, ...log.updated]) {
      // Cursor on delivery time: corrected or backdated CVE metadata must not be missed.
      result.push(item("core-cve", entry.cveId, log.fetchTime));
    }
  }
  return {
    items: result,
    until: new Date(
      Math.max(...logs.map((log) => Date.parse(log.fetchTime))),
    ).toISOString(),
  };
}
export async function discover(
  source: StructuredId,
  stateValue: unknown,
  limit = 2000,
): Promise<Discovery> {
  const state = syncStateSchema.parse(stateValue);
  if (source === "core-osv") {
    const until = state.until ?? new Date().toISOString();
    return page(await osvChanges(state.since), state, until, limit);
  }
  if (source === "core-cve") {
    // Finish the archived window before switching to the rolling log. page()
    // preserves this ref on partial pages and removes it only once staging ends.
    const endpoint = state.cve_bootstrap_ref
      ? `https://raw.githubusercontent.com/CVEProject/cvelistV5/${state.cve_bootstrap_ref}/cves/deltaLog.json`
      : endpoints.cve;
    const raw = JSON.parse(
      await fetchText(
        endpoint,
        ["https://raw.githubusercontent.com"],
        64_000_000,
      ),
    );
    const changes = cveChanges(raw, state.since);
    return page(
      changes.items,
      state,
      state.until ??
        new Date(
          Math.max(Date.parse(state.since), Date.parse(changes.until)),
        ).toISOString(),
      limit,
    );
  }
  const catalog = z
    .object({
      dateReleased: timestamp,
      vulnerabilities: z.array(kevEntry).min(1).max(20000),
    })
    .parse(
      JSON.parse(
        await fetchText(
          endpoints.kev,
          ["https://raw.githubusercontent.com"],
          10_000_000,
        ),
      ),
    );
  const ids = catalog.vulnerabilities.map((r) => r.cveID);
  if (new Set(ids).size !== ids.length)
    throw new Error("Duplicate KEV identifiers");
  const rows: RecordItem[] = catalog.vulnerabilities.map((r) => ({
    ...item(source, r.cveID, r.dateAdded),
    structured: { id: r.cveID, modified: r.dateAdded, record: r },
  }));
  for (const id of state.kev_ids ?? [])
    if (!ids.includes(id))
      rows.push({
        ...item(source, id, catalog.dateReleased),
        structured: {
          id,
          modified: catalog.dateReleased,
          record: { cveID: id, removed: true, removedAt: catalog.dateReleased },
        },
      });
  // The complete KEV snapshot is small and staged in bounded batches; no missing removal on page boundaries.
  return {
    items: rows,
    state: { since: catalog.dateReleased, kev_ids: ids },
    more: false,
  };
}
