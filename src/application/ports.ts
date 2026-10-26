import type { EvidencePayload } from "../domain/evidence";
import type {
  FeedItem,
  FeedQuery,
  SourceRecord,
  StoredItem,
} from "../domain/feed-item";
import type { TechnologyOption } from "../domain/technology";
export type DocumentJob = {
  id: number;
  source_id: string;
  source_url: string;
  source_published_at: string | null;
  body: string;
  lease_token: string;
};
export type NormalizedDocument = {
  payload: EvidencePayload;
  method: SourceRecord["method"];
  model: string;
};
export type Publication = {
  records: SourceRecord[];
  document?: { job: DocumentJob; normalized: NormalizedDocument };
  migration_cursor?: number;
  at: string;
};
export interface FeedRepository {
  list(query: FeedQuery, changes?: boolean): Promise<FeedItem[]>;
  find(id: string): Promise<FeedItem | null>;
  publish(
    command: Publication,
    update: (scope: StoredItem[]) => StoredItem[],
  ): Promise<void>;
  technologies(
    search: string,
    selected?: string[],
  ): Promise<TechnologyOption[]>;
  sitemapParts(): Promise<number[]>;
  sitemapItems(
    after: number,
    through: number,
  ): Promise<{ id: string; cursor: number }[]>;
}
export type SourceJob = {
  id: string;
  lease_token: string;
  definition: unknown;
  checkpoint?: unknown;
  etag: string | null;
  last_modified: string | null;
};
export type EntryJob = {
  id: number;
  lease_token: string;
  source_id: string;
  source_url: string;
  item: unknown;
  feed_title: string;
  definition: unknown;
};
export type DiscoveredEntry = {
  url: string;
  fingerprint: string;
  item: unknown;
  feed_title: string;
};
export type Discovery = {
  entries: DiscoveredEntry[];
  checkpoint?: unknown;
  etag?: string | null;
  last_modified?: string | null;
  not_modified: boolean;
};
export type CollectedDocument = {
  body: string;
  hash: string;
  published_at: string | null;
  skipped: boolean;
};
export interface SourceReader {
  discover(source: SourceJob): Promise<Discovery>;
  collect(entry: EntryJob): Promise<CollectedDocument>;
  normalize(document: DocumentJob): Promise<NormalizedDocument>;
}
export interface IngestionQueue {
  claimSource(): Promise<SourceJob | null>;
  stage(source: SourceJob, entries: DiscoveredEntry[]): Promise<void>;
  finishSource(
    source: SourceJob,
    result: Discovery | null,
    error?: string,
  ): Promise<void>;
  claimEntry(): Promise<EntryJob | null>;
  finishEntry(entry: EntryJob, result: CollectedDocument): Promise<boolean>;
  failEntry(entry: EntryJob, reason: string): Promise<void>;
  claimDocument(
    sourceIds: string[],
    hourlyBudget?: number,
  ): Promise<DocumentJob | null>;
  failDocument(document: DocumentJob, reason: string): Promise<void>;
  health(): Promise<Record<string, number>>;
}
