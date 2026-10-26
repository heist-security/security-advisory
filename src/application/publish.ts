import type { DocumentJob, FeedRepository, NormalizedDocument } from "./ports";
import type { SourceRecord } from "../domain/feed-item";
import { recordId } from "../domain/identity";
import { reconcile } from "../domain/reconcile";
export function publisher(repository: FeedRepository, now: () => Date) {
  return async (job: DocumentJob, normalized: NormalizedDocument) => {
    const record: SourceRecord = {
      id: recordId(job.source_id, job.source_url),
      source_id: job.source_id,
      url: job.source_url,
      document_id: job.id,
      published_at: job.source_published_at,
      method: normalized.method,
      payload: normalized.payload,
    };
    const at = now().toISOString();
    await repository.publish(
      { records: [record], document: { job, normalized }, at },
      (scope) => reconcile(scope, [record], at),
    );
  };
}
