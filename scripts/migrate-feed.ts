import { pathToFileURL } from "node:url";
import {
  database,
  closeDatabase,
  type Database,
} from "../src/adapters/postgres/client";
import { feedRepository } from "../src/adapters/postgres/feed-repository";
import { reconcile } from "../src/domain/reconcile";
import { recordId } from "../src/domain/identity";
import type { SourceRecord } from "../src/domain/feed-item";
import type { EvidencePayload } from "../src/domain/evidence";

/** One-time, resumable import. It uses the same domain rules as live ingestion. */
export async function migrateFeed(
  db: Database,
  progress: (message: string) => void = () => {},
  batchSize = 100,
) {
  const repository = feedRepository(db);
  for (let batch = 0; batch < 10000; batch++) {
    const {
      rows: [checkpoint],
    } = await db.query<{ last_event_id: string; completed_at: string | null }>(
      "select last_event_id,completed_at from feed_migration",
    );
    if (checkpoint.completed_at) return;
    const { rows } = await db.query<{
      event: {
        id: number;
        document_id: number;
        source_id: string;
        source_url: string;
        source_published_at: string | null;
        published_at: string;
        extraction_method: string;
        payload: EvidencePayload;
      };
    }>(
      `select to_jsonb(e)||jsonb_build_object('document_id',a.latest_document_id) event
      from events e join advisories a on a.id=e.advisory_id
      where e.id>$1 and not exists(select 1 from events newer where newer.advisory_id=e.advisory_id and newer.id>e.id)
      order by e.id limit $2`,
      [checkpoint.last_event_id, batchSize],
    );
    if (!rows.length) {
      await db.query("select finish_feed_migration()");
      progress("Canonical feed import completed; source revisions archived.");
      return;
    }
    const records: SourceRecord[] = rows.map(({ event: e }) => ({
      id: recordId(e.source_id, e.source_url),
      source_id: e.source_id,
      url: e.source_url,
      published_at: e.source_published_at,
      document_id: e.document_id,
      method:
        e.extraction_method === "system"
          ? "system"
          : e.source_id.startsWith("core-")
            ? "structured"
            : "llm",
      payload: {
        ...e.payload,
        security_relevant: true,
        title: e.payload.title || e.payload.structured?.id || e.source_id,
        summary: e.payload.summary ?? "",
        evidence: e.payload.evidence ?? "",
        products: e.payload.products ?? [],
        related_cves: e.payload.related_cves ?? [],
        severity: e.payload.severity ?? "unknown",
        severity_evidence: e.payload.severity_evidence ?? null,
      },
    }));
    const cursor = rows.at(-1)!.event.id,
      at = rows.at(-1)!.event.published_at;
    await repository.publish(
      { records, migration_cursor: cursor, at },
      (scope) => reconcile(scope, records, at),
    );
    progress(
      `Imported ${records.length} source records; checkpoint ${cursor}.`,
    );
  }
  throw new Error("Import batch limit reached; rerun to resume");
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  migrateFeed(database(), console.info)
    .catch(() => {
      console.error(
        "Feed import failed; committed batches are retained. Inspect the database privately and rerun.",
      );
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
