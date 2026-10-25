import { createHash } from "node:crypto";
import type { Item } from "rss-parser";
import { db } from "./db";
import { fetchResource } from "./http";
import { extract } from "./extract";
import {
  documentText,
  itemUrl,
  NoReleaseNotesError,
  parseFeed,
  sourceSchema,
  type Source,
} from "./feed";
import { setting } from "./config";
import { failureReason } from "./errors";
import { isStructured } from "./structured/config";
import { selectedVendorIds } from "./vendor-config";
import {
  stageStructured,
  structuredDocument,
  readStructuredDocument,
  processStructuredJobs,
} from "./structured/pipeline";
function digest(text: string) {
  return createHash("sha256").update(text).digest("hex");
}
type ClaimedSource = Source & {
  lease_token: string;
  etag: string | null;
  last_modified: string | null;
  verification?: Record<string, unknown>;
};
type Client = ReturnType<typeof db>;

async function pollSource(
  client: Client,
  source: ClaimedSource,
  deadline: number,
) {
  let staged = 0;
  let failures = 0;
  let resource: Awaited<ReturnType<typeof fetchResource>> | undefined;
  try {
    sourceSchema.parse(source);
    if (isStructured(source.id)) {
      staged = await stageStructured(
        client,
        { ...source, id: source.id },
        deadline,
      );
    } else {
      resource = await fetchResource(source.feed_url, source.allowed_origins, {
        ...(source.adapter === "feed-content" ? source : {}),
        max_bytes: source.max_feed_bytes,
      });
      if (resource.text !== null) {
        const feed = await parseFeed(resource.text);
        if (!feed.items.length) throw new Error("Feed has no entries");
        if (feed.items.length > 20000)
          throw new Error(
            "Entry limit exceeded; source requires a paginated adapter",
          );
        // Enumerate the complete fetched feed, then collect documents from a durable queue.
        // A crash halfway through staging is safe: validators are only committed after all batches.
        const unique = new Map<
          string,
          { url: string; fingerprint: string; item: Item; feed_title: string }
        >();
        for (const item of feed.items) {
          try {
            const url = itemUrl(source, item);
            const feed_title = feed.title ?? source.name;
            if (!unique.has(url))
              unique.set(url, {
                url,
                fingerprint: digest(JSON.stringify([item, feed_title])),
                item,
                feed_title,
              });
          } catch {
            failures++;
          }
        }
        const entries = [...unique.values()];
        for (let index = 0; index < entries.length; index += 500) {
          if (Date.now() >= deadline)
            throw new Error("Polling deadline exceeded");
          const { error } = await client.rpc("stage_feed_entries", {
            p_source: source.id,
            p_token: source.lease_token,
            p_entries: entries.slice(index, index + 500),
          });
          if (error) throw error;
          staged += entries.slice(index, index + 500).length;
        }
      }
    }
    const { error } = await client.rpc("complete_source", {
      source_id: source.id,
      token: source.lease_token,
      succeeded: failures === 0,
      message: failures ? "source_url_rejected" : null,
      new_etag: failures ? null : (resource?.etag ?? null),
      new_last_modified: failures ? null : (resource?.last_modified ?? null),
    });
    if (error) throw error;
  } catch (error) {
    const result = await client.rpc("complete_source", {
      source_id: source.id,
      token: source.lease_token,
      succeeded: false,
      message: failureReason(error),
      new_etag: null,
      new_last_modified: null,
    });
    if (result.error) throw result.error;
    failures++;
  }
  return { staged, failures, not_modified: resource?.status === 304 ? 1 : 0 };
}

export async function poll() {
  const client = db(),
    start = Date.now();
  const maximum = setting("POLL_BATCH_SIZE", 12, 1, 50),
    concurrency = setting("POLL_CONCURRENCY", 4, 1, 8);
  let slots = 0;
  const totals = {
    sources: 0,
    entries_staged: 0,
    failures: 0,
    not_modified: 0,
  };
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (slots < maximum && Date.now() - start < 60000) {
        slots++;
        const { data, error } = await client.rpc("claim_source");
        if (error) throw error;
        const source = data?.[0] as ClaimedSource | undefined;
        if (!source) break;
        const result = await pollSource(client, source, start + 240000);
        totals.sources++;
        totals.entries_staged += result.staged;
        totals.failures += result.failures;
        totals.not_modified += result.not_modified;
      }
    }),
  );
  return totals;
}

export async function collect() {
  const client = db(),
    start = Date.now();
  const maximum = setting("COLLECT_BATCH_SIZE", 60, 1, 500),
    concurrency = setting("COLLECT_CONCURRENCY", 4, 1, 12);
  let slots = 0;
  const totals = { collected: 0, added: 0, skipped: 0, failed: 0 };
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (slots < maximum && Date.now() - start < 180000) {
        slots++;
        const { data, error } = await client.rpc("claim_feed_entry");
        if (error) throw error;
        const job = data?.[0];
        if (!job) break;
        const { entry, source } = job;
        try {
          let body = "";
          let skipped = false;
          let structuredPublished: string | null | undefined;
          try {
            if (isStructured(source.id)) {
              const document = await structuredDocument(source.id, entry.item);
              body = document.body;
              structuredPublished = document.published;
            } else
              body = (
                await documentText(
                  sourceSchema.parse(source),
                  entry.item,
                  entry.feed_title,
                )
              ).body;
          } catch (error) {
            if (error instanceof NoReleaseNotesError) skipped = true;
            else throw error;
          }
          const date =
            structuredPublished !== undefined
              ? structuredPublished
              : entry.item.isoDate;
          const published =
            date && Number.isFinite(Date.parse(date))
              ? new Date(date).toISOString()
              : null;
          const result = await client.rpc("complete_feed_entry", {
            p_id: entry.id,
            p_token: entry.lease_token,
            p_body: body,
            p_hash: digest(body),
            p_published: published,
            p_skipped: skipped,
          });
          if (result.error) throw result.error;
          totals.collected++;
          if (result.data) totals.added++;
          if (skipped) totals.skipped++;
        } catch (error) {
          const result = await client.rpc("fail_feed_entry", {
            p_id: entry.id,
            p_token: entry.lease_token,
            p_reason: failureReason(error),
          });
          if (result.error) throw result.error;
          totals.failed++;
        }
      }
    }),
  );
  return totals;
}

export async function processJobs() {
  const start = Date.now();
  const client = db();
  const structured = await processStructuredJobs(client);
  // Structured publication needs no model credential or paid-attempt reservation.
  // Vendor processing is explicitly opt-in and retains the database-enforced shared budget.
  if (
    !process.env.OPENAI_API_KEY ||
    !process.env.OPENAI_MODEL ||
    !process.env.VENDOR_SOURCE_IDS?.trim()
  )
    return { ...structured, vendor_disabled: 1 };
  const vendorIds = new Set(selectedVendorIds());
  if (!vendorIds.size) return { ...structured, vendor_disabled: 1 };
  const maximum = setting("PROCESS_BATCH_SIZE", 24, 1, 100),
    concurrency = setting("PROCESS_CONCURRENCY", 4, 1, 12);
  const hourlyLimit = setting("EXTRACTION_HOURLY_LIMIT", 60, 1, 10000);
  let slots = 0,
    processed = 0,
    failed = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (slots < maximum && Date.now() - start < 240000) {
        slots++;
        const { data, error } = await client.rpc("claim_vendor_document", {
          hourly_limit: hourlyLimit,
          source_ids: [...vendorIds],
        });
        if (error) throw error;
        const job = data?.[0];
        if (!job) break;
        try {
          const structuredJob = isStructured(job.source_id);
          if (!structuredJob && !vendorIds.has(job.source_id))
            throw new Error("Source not selected");
          const normalized = structuredJob
            ? readStructuredDocument(job).payload
            : await extract(job.body);
          const result = await client.rpc("finish_document", {
            document_id: job.id,
            token: job.lease_token,
            result: normalized,
            model_name: structuredJob
              ? `structured:${job.source_id.slice(5)}:1`
              : process.env.OPENAI_MODEL,
          });
          if (result.error) throw result.error;
          processed++;
        } catch (error) {
          const reason = failureReason(error);
          const result = await client.rpc("fail_document", {
            document_id: job.id,
            token: job.lease_token,
            reason,
          });
          if (result.error) throw result.error;
          console.warn(JSON.stringify({ operation: "extract", reason }));
          failed++;
        }
      }
    }),
  );
  return {
    processed: processed + structured.processed,
    failed: failed + structured.failed,
  };
}
