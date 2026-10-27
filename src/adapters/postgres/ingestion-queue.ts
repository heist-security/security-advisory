import type {
  IngestionQueue,
  DocumentJob,
  SourceJob,
  EntryJob,
} from "../../application/ports";
import { structuredIds } from "../sources/structured/config";
import { syncStateSchema } from "../sources/structured/discover";
import type { Database } from "./client";
export function ingestionQueue(db: Database): IngestionQueue {
  return {
    async claimSource() {
      const { rows } = await db.query<{ source: Record<string, unknown> }>(
        "select to_jsonb(s) source from claim_source() s",
      );
      const s = rows[0]?.source;
      return s
        ? ({
            id: s.id,
            lease_token: s.lease_token,
            definition: s,
            checkpoint: (s.verification as { sync?: unknown })?.sync,
            etag: s.etag,
            last_modified: s.last_modified,
          } as SourceJob)
        : null;
    },
    async stage(source, entries) {
      await db.query("select stage_feed_entries($1,$2,$3::jsonb)", [
        source.id,
        source.lease_token,
        JSON.stringify(entries),
      ]);
    },
    async finishSource(source, result, error) {
      await db.transaction(async (client) => {
        const leased = await client.query(
          "select id from sources where id=$1 and lease_token=$2 and leased_until>now() for update",
          [source.id, source.lease_token],
        );
        if (!leased.rows.length)
          throw new Error("Source lease expired or replaced");
        if (result?.checkpoint !== undefined)
          await client.query(
            "update sources set verification=jsonb_set(coalesce(verification,'{}'),'{sync}',$2::jsonb) where id=$1",
            [source.id, JSON.stringify(result.checkpoint)],
          );
        await client.query("select complete_source($1,$2,$3,$4,$5,$6)", [
          source.id,
          source.lease_token,
          !error,
          error ?? null,
          result?.etag ?? null,
          result?.last_modified ?? null,
        ]);
      });
    },
    async claimEntry() {
      const { rows } = await db.query<{
        entry: Record<string, unknown>;
        source: unknown;
      }>("select * from claim_feed_entry()");
      if (!rows[0]) return null;
      return { ...rows[0].entry, definition: rows[0].source } as EntryJob;
    },
    async finishEntry(entry, result) {
      return (
        await db.query<{ added: boolean }>(
          "select complete_feed_entry($1,$2,$3,$4,$5,$6) added",
          [
            entry.id,
            entry.lease_token,
            result.body,
            result.hash,
            result.published_at,
            result.skipped,
          ],
        )
      ).rows[0].added;
    },
    async failEntry(entry, reason) {
      await db.query("select fail_feed_entry($1,$2,$3)", [
        entry.id,
        entry.lease_token,
        reason,
      ]);
    },
    async claimDocument(ids, budget) {
      const { rows } = await db.query<{ job: DocumentJob }>(
        "select to_jsonb(d) job from claim_ingest_document($1,$2) d",
        [ids, budget ?? null],
      );
      return rows[0]?.job ?? null;
    },
    async failDocument(job, reason) {
      await db.query("select fail_document($1,$2,$3)", [
        job.id,
        job.lease_token,
        reason,
      ]);
    },
    async health() {
      const { rows } = await db.query<{
        health: Record<string, number>;
      }>(`select jsonb_build_object(
        'migration_ready',(select (completed_at is not null)::integer from feed_migration),
        'sources_enabled',(select count(*) from sources where enabled),
        'sources_failing',(select count(*) from sources where enabled and consecutive_failures>0),
        'sources_overdue',(select count(*) from sources where enabled and next_poll_at<now()-interval '30 minutes'),
        'collection_pending',(select count(*) from feed_entries where status in ('pending','processing')),
        'collection_failed',(select count(*) from feed_entries where status='failed'),
        'collection_oldest_seconds',(select coalesce(extract(epoch from now()-min(observed_at)),0) from feed_entries where status in ('pending','processing')),
        'extraction_pending',(select count(*) from documents where status in ('pending','processing')),
        'extraction_failed',(select count(*) from documents where status='failed'),
        'extraction_oldest_seconds',(select coalesce(extract(epoch from now()-min(observed_at)),0) from documents where status in ('pending','processing'))
      ) health`);
      const sources = await db.query<{
        id: string;
        enabled: boolean;
        verification: { sync?: unknown };
      }>(
        "select id,enabled,verification from sources where id=any($1::text[])",
        [[...structuredIds]],
      );
      return {
        ...rows[0].health,
        structured_sources_configured: Number(
          structuredIds.every((id) =>
            sources.rows.some(
              (s) =>
                s.id === id &&
                s.enabled &&
                syncStateSchema.safeParse(s.verification?.sync).success,
            ),
          ),
        ),
      };
    },
  };
}
