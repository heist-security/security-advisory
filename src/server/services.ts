import { registry, vendorRegistry } from "../adapters/sources/registry";
import { database } from "../adapters/postgres/client";
import { feedRepository } from "../adapters/postgres/feed-repository";
import { ingestionQueue } from "../adapters/postgres/ingestion-queue";
import { sourceReader } from "../adapters/sources/reader";
import { selectedVendorIds } from "../adapters/sources/selection";
import { structuredIds } from "../adapters/sources/structured/config";
import { setting } from "../adapters/environment";
import { ingestion } from "../application/ingest";
import { publisher } from "../application/publish";
export {
  registry,
  vendorRegistry,
  sourcePage,
} from "../adapters/sources/registry";
export { riskContext } from "../adapters/risk/provider";
export const configured = () =>
  Boolean(process.env.DATABASE_URL || process.env.SUPABASE_DB_URL);
export const baseUrl = () =>
  (process.env.PUBLIC_BASE_URL || "http://localhost:3000").replace(/\/$/, "");
export function services() {
  const db = database(),
    feed = feedRepository(db),
    queue = ingestionQueue(db),
    now = () => new Date();
  return {
    feed,
    get ingestion() {
      return ingestion(
        queue,
        sourceReader,
        publisher(feed, now),
        {
          pollBatch: setting("POLL_BATCH_SIZE", 12, 1, 50),
          collectBatch: setting("COLLECT_BATCH_SIZE", 60, 1, 500),
          structuredBatch: setting(
            "STRUCTURED_PROCESS_BATCH_SIZE",
            120,
            1,
            1000,
          ),
          publisherBatch: setting("PROCESS_BATCH_SIZE", 24, 1, 100),
          pollConcurrency: setting("POLL_CONCURRENCY", 4, 1, 8),
          collectConcurrency: setting("COLLECT_CONCURRENCY", 4, 1, 12),
          processConcurrency: setting("PROCESS_CONCURRENCY", 4, 1, 12),
          structuredIds: [...structuredIds],
          publisherIds:
            process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL
              ? selectedVendorIds()
              : [],
          hourlyBudget: setting("EXTRACTION_HOURLY_LIMIT", 60, 1, 10000),
        },
        now,
      );
    },
  };
}

const sourceNames = new Map(
  [...vendorRegistry, ...registry].map((source) => [source.id, source.name]),
);
export const sourceName = (id: string) => sourceNames.get(id) ?? id;
