import { z } from "zod";
import { fetchText } from "../../http";
import { recordUrl, sourceUrl, type RecordItem } from "./discover";
import {
  normalizeRecord,
  structuredPayloadSchema,
  type Normalized,
} from "./normalize";
import { isStructured, type StructuredId } from "./config";
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
