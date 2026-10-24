import { createHash } from "node:crypto";
import { db } from "./db";
import { fetchResource } from "./http";
import { extract } from "./extract";
import { documentText, NoReleaseNotesError, parseFeed, sourceSchema, type Source } from "./feed";
import { setting } from "./config";
export { articleText } from "./feed";
export function digest(text: string) { return createHash("sha256").update(text).digest("hex"); }
type ClaimedSource = Source & { lease_token: string; etag: string | null; last_modified: string | null };
type Client = ReturnType<typeof db>;
function errorMessage(error: unknown) { return error instanceof Error ? error.message.slice(0, 250) : "Database or source operation failed"; }

async function pollSource(client: Client, source: ClaimedSource) {
  const started = Date.now();
  let checked = 0; let added = 0; let failed = 0; let skipped = 0;
  let failure: string | null = null;
  let resource: Awaited<ReturnType<typeof fetchResource>> | undefined;
  try {
    sourceSchema.parse(source);
    // Article bodies can change even when the publisher leaves the RSS unchanged.
    // Only inline-content sources can safely skip documents after an RSS 304.
    resource = await fetchResource(source.feed_url, source.allowed_origins, {
      ...(source.adapter === "feed-content" ? source : {}), max_bytes: source.max_feed_bytes,
    });
    if (resource.text !== null) {
      const feed = await parseFeed(resource.text);
      const items = feed.items.slice(0, setting("POLL_MAX_ITEMS", 30, 1, 30));
      if (!items.length) throw new Error("Feed has no entries");
      for (let index = 0; index < items.length; index += 3) {
        if (Date.now() - started > 100000) { failed++; failure = "Source window exceeded time budget; remaining entries require retry or a dedicated adapter"; break; }
        await Promise.all(items.slice(index, index + 3).map(async item => {
          try {
            const { url, body } = await documentText(source, item, feed.title);
            const published = item.isoDate && Number.isFinite(Date.parse(item.isoDate)) ? new Date(item.isoDate).toISOString() : null;
            const result = await client.rpc("enqueue_document", { source: source.id, url, hash: digest(body), content: body, published });
            if (result.error) throw result.error;
            checked++; if (result.data) added++;
          } catch (error) {
            if (error instanceof NoReleaseNotesError) skipped++;
            else { failed++; failure ??= errorMessage(error); }
          }
        }));
      }
      if (!checked && skipped) { failed++; failure = "Current feed window has no substantive release notes"; }
    }
    // Do not cache a partial poll: a 304 next time would prevent retrying failed articles.
    const complete = await client.rpc("complete_source", {
      source_id: source.id, token: source.lease_token, succeeded: failed === 0,
      message: failed ? `${failed} item failures: ${failure}` : null,
      new_etag: failed ? null : resource.etag, new_last_modified: failed ? null : resource.last_modified,
    });
    if (complete.error) throw complete.error;
  } catch (error) {
    const result = await client.rpc("complete_source", { source_id: source.id, token: source.lease_token, succeeded: false, message: errorMessage(error), new_etag: null, new_last_modified: null });
    if (result.error) throw result.error;
    failed++;
  }
  return { checked, added, failed, skipped, not_modified: resource?.status === 304 ? 1 : 0 };
}

export async function poll() {
  const client = db(); const start = Date.now();
  const maximum = setting("POLL_BATCH_SIZE", 12, 1, 50);
  const concurrency = setting("POLL_CONCURRENCY", 4, 1, 8);
  let slots = 0;
  const totals = { sources: 0, documents_checked: 0, documents_added: 0, failures: 0, skipped: 0, not_modified: 0 };
  await Promise.all(Array.from({ length: concurrency }, async () => {
    // Stop starting sources after 140 seconds. Per-source work is bounded,
    // with time reserved for the final fetch/RPC group and lease completion.
    while (slots < maximum && Date.now() - start < 140000) {
      slots++;
      const { data, error } = await client.rpc("claim_source");
      if (error) throw error;
      const source = data?.[0] as ClaimedSource | undefined; if (!source) break;
      const result = await pollSource(client, source);
      totals.sources++; totals.documents_checked += result.checked; totals.documents_added += result.added;
      totals.failures += result.failed; totals.skipped += result.skipped; totals.not_modified += result.not_modified;
    }
  }));
  return totals;
}

export async function processJobs() {
  // Fail before claiming work if secrets/model are missing; do not exhaust the queue.
  if (!process.env.OPENAI_API_KEY || !process.env.OPENAI_MODEL) throw new Error("Extraction is not configured");
  const client = db(); const start = Date.now(); let slots = 0; let processed = 0; let failed = 0;
  const maximum = setting("PROCESS_BATCH_SIZE", 24, 1, 100);
  const concurrency = setting("PROCESS_CONCURRENCY", 4, 1, 12);
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (slots < maximum && Date.now() - start < 180000) {
      slots++;
      const { data, error } = await client.rpc("claim_document");
      if (error) throw error;
      const job = data?.[0]; if (!job) break;
      try {
        const normalized = await extract(job.body);
        const result = await client.rpc("finish_document", { document_id: job.id, token: job.lease_token, result: normalized, model_name: process.env.OPENAI_MODEL });
        if (result.error) throw result.error;
        processed++;
      } catch {
        const { error: retryError } = await client.rpc("fail_document", { document_id: job.id, token: job.lease_token });
        if (retryError) throw retryError;
        failed++;
      }
    }
  }));
  return { processed, failed };
}
