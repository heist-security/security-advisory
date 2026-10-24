import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "../db";
import { setting } from "../config";
import { failureReason } from "../errors";
import { fetchText } from "../http";
import { discover, recordUrl, sourceUrl, type RecordItem } from "./discover";
import {
  normalizeRecord,
  structuredPayloadSchema,
  type Normalized,
} from "./normalize";
import { isStructured, structuredIds, type StructuredId } from "./config";

type Client = ReturnType<typeof db>;
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
export async function stageStructured(
  client: Client,
  source: {
    id: StructuredId;
    lease_token: string;
    verification?: Record<string, unknown>;
  },
  deadline: number,
) {
  const result = await discover(source.id, source.verification?.sync);
  for (let index = 0; index < result.items.length; index += 500) {
    if (Date.now() >= deadline) throw new Error("Polling deadline exceeded");
    const { error } = await client.rpc("stage_feed_entries", {
      p_source: source.id,
      p_token: source.lease_token,
      p_entries: result.items.slice(index, index + 500).map((item) => ({
        url: item.link,
        fingerprint: hash(JSON.stringify(item)),
        item,
        feed_title: source.id,
      })),
    });
    if (error) throw error;
  }
  // Cursor is independent of HTTP validators, which complete_source clears on a failed poll.
  // Advance only after every entry is durable. An interrupted poll replays idempotently.
  const checkpoint = await client
    .from("sources")
    .update({ verification: { ...source.verification, sync: result.state } })
    .eq("id", source.id)
    .eq("lease_token", source.lease_token)
    .gt("leased_until", new Date().toISOString())
    .select("id");
  if (checkpoint.error) throw checkpoint.error;
  if (checkpoint.data?.length !== 1)
    throw new Error("Source lease expired or replaced");
  return result.items.length;
}
const queuedItem = z.object({
  structured: z.object({
    id: z.string(),
    modified: z.string(),
    record: z.unknown().optional(),
  }),
  link: z.string(),
});
export async function structuredDocument(
  source: StructuredId,
  rawItem: unknown,
) {
  const item = queuedItem.parse(rawItem) as RecordItem;
  if (item.link !== sourceUrl(source, item.structured.id))
    throw new Error("Structured source URL mismatch");
  const record =
    source === "core-kev"
      ? item.structured.record
      : JSON.parse(
          await fetchText(
            recordUrl(source, item.structured.id),
            source === "core-osv"
              ? ["https://api.osv.dev"]
              : ["https://raw.githubusercontent.com"],
            4_000_000,
          ),
        );
  const normalized = normalizeRecord(source, record);
  if (
    normalized.payload.structured.id !== item.structured.id ||
    normalized.url !== item.link
  )
    throw new Error("Structured record identity mismatch");
  const body = JSON.stringify({
    normalization_version: 1,
    source_id: source,
    ...normalized,
  });
  if (body.length > 50000)
    throw new Error("Structured document exceeds byte limit");
  return { body, published: normalized.published };
}
export function readStructuredDocument(job: {
  source_id: string;
  source_url: string;
  body: string;
}): Normalized {
  const envelope = z
    .object({
      normalization_version: z.literal(1),
      source_id: z.string(),
      url: z.string(),
      published: z.string().nullable(),
      payload: structuredPayloadSchema,
    })
    .parse(JSON.parse(job.body));
  if (
    !isStructured(job.source_id) ||
    envelope.source_id !== job.source_id ||
    `core-${envelope.payload.structured.provider}` !== job.source_id ||
    envelope.url !== job.source_url ||
    envelope.url !== sourceUrl(job.source_id, envelope.payload.structured.id)
  )
    throw new Error("Structured document identity mismatch");
  return envelope;
}
export type DocumentJob = {
  id: number;
  source_id: string;
  source_url: string;
  body: string;
  status: string;
  attempts: number;
  lease_token: string | null;
};
export async function claimStructured(client: Client, now = new Date()) {
  const timestamp = now.toISOString();
  const cleanup = await client
    .from("documents")
    .update({
      status: "failed",
      last_error: "lease_expired",
      lease_token: null,
      leased_until: null,
    })
    .in("source_id", [...structuredIds])
    .eq("status", "processing")
    .gte("attempts", 5)
    .lte("leased_until", timestamp);
  if (cleanup.error) throw cleanup.error;
  // Optimistic, fenced claim using the existing table. A competing worker (including the old RPC)
  // changes status/attempts, so exactly one conditional UPDATE can return this candidate.
  const candidate = await client
    .from("documents")
    .select("id,source_id,source_url,body,status,attempts,lease_token")
    .in("source_id", [...structuredIds])
    .lt("attempts", 5)
    .lte("available_at", timestamp)
    .or(
      `status.eq.pending,and(status.eq.processing,leased_until.lte.${timestamp})`,
    )
    .order("id")
    .limit(1);
  if (candidate.error) throw candidate.error;
  const job = candidate.data?.[0] as DocumentJob | undefined;
  if (!job) return null;
  const token = randomUUID();
  let update = client
    .from("documents")
    .update({
      status: "processing",
      attempts: job.attempts + 1,
      lease_token: token,
      leased_until: new Date(now.getTime() + 180000).toISOString(),
    })
    .eq("id", job.id)
    .eq("status", job.status)
    .eq("attempts", job.attempts);
  if (job.status === "processing")
    update = update
      .eq("lease_token", job.lease_token!)
      .lte("leased_until", timestamp);
  const claimed = await update.select("id");
  if (claimed.error) throw claimed.error;
  return claimed.data?.length === 1 ? { ...job, lease_token: token } : null;
}
export async function finishStructured(
  client: Client,
  job: DocumentJob & { lease_token: string },
) {
  const normalized = readStructuredDocument(job);
  const result = await client.rpc("finish_document", {
    document_id: job.id,
    token: job.lease_token,
    result: normalized.payload,
    model_name: `structured:${normalized.payload.structured.provider}:1`,
  });
  if (result.error) throw result.error;
}
export async function processStructuredJobs(client: Client) {
  let processed = 0,
    failed = 0;
  const maximum = setting("STRUCTURED_PROCESS_BATCH_SIZE", 120, 1, 1000),
    start = Date.now();
  for (let slot = 0; slot < maximum && Date.now() - start < 120000; slot++) {
    const job = await claimStructured(client);
    if (!job) break;
    try {
      await finishStructured(client, job);
      processed++;
    } catch (error) {
      const result = await client.rpc("fail_document", {
        document_id: job.id,
        token: job.lease_token,
        reason: failureReason(error),
      });
      if (result.error) throw result.error;
      failed++;
    }
  }
  return { processed, failed };
}
