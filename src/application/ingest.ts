import type {
  IngestionQueue,
  SourceReader,
  DocumentJob,
  NormalizedDocument,
} from "./ports";
import { failureReason } from "./errors";
type Options = {
  pollBatch: number;
  collectBatch: number;
  structuredBatch: number;
  publisherBatch: number;
  pollConcurrency: number;
  collectConcurrency: number;
  processConcurrency: number;
  structuredIds: string[];
  publisherIds: string[];
  hourlyBudget: number;
};
export function ingestion(
  queue: IngestionQueue,
  reader: SourceReader,
  publish: (job: DocumentJob, result: NormalizedDocument) => Promise<void>,
  options: Options,
  now: () => Date,
) {
  async function work<T>(
    maximum: number,
    duration: number,
    concurrency: number,
    claim: () => Promise<T | null>,
    run: (job: T) => Promise<void>,
  ) {
    const deadline = now().getTime() + duration;
    let slots = 0;
    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (slots++ < maximum && now().getTime() < deadline) {
          const job = await claim();
          if (!job) break;
          await run(job);
        }
      }),
    );
  }
  return {
    async poll() {
      const deadline = now().getTime() + 240000;
      const counts = {
        sources: 0,
        entries_staged: 0,
        failed: 0,
        not_modified: 0,
      };
      await work(
        options.pollBatch,
        60000,
        options.pollConcurrency,
        () => queue.claimSource(),
        async (source) => {
          try {
            const result = await reader.discover(source);
            for (let i = 0; i < result.entries.length; i += 500) {
              if (now().getTime() >= deadline)
                throw new Error("Polling deadline exceeded");
              await queue.stage(source, result.entries.slice(i, i + 500));
            }
            counts.entries_staged += result.entries.length;
            if (result.rejected_entries) {
              await queue.finishSource(source, null, "source_url_rejected");
              counts.failed++;
            } else {
              await queue.finishSource(source, result);
              counts.sources++;
              counts.not_modified += Number(result.not_modified);
            }
          } catch (error) {
            await queue.finishSource(source, null, failureReason(error));
            counts.failed++;
          }
        },
      );
      return counts;
    },
    async collect() {
      const counts = { collected: 0, added: 0, skipped: 0, failed: 0 };
      await work(
        options.collectBatch,
        180000,
        options.collectConcurrency,
        () => queue.claimEntry(),
        async (entry) => {
          try {
            const result = await reader.collect(entry);
            counts.added += Number(await queue.finishEntry(entry, result));
            counts.collected++;
            counts.skipped += Number(result.skipped);
          } catch (error) {
            await queue.failEntry(entry, failureReason(error));
            counts.failed++;
          }
        },
      );
      return counts;
    },
    async process() {
      const counts = { processed: 0, failed: 0 };
      const deadline = now().getTime() + 180000;
      for (const [ids, batch, budget] of [
        [options.structuredIds, options.structuredBatch, undefined],
        [options.publisherIds, options.publisherBatch, options.hourlyBudget],
      ] as const) {
        if (!ids.length) continue;
        await work(
          batch,
          Math.min(120000, deadline - now().getTime()),
          options.processConcurrency,
          () => queue.claimDocument([...ids], budget),
          async (job) => {
            try {
              await publish(job, await reader.normalize(job));
              counts.processed++;
            } catch (error) {
              await queue.failDocument(job, failureReason(error));
              counts.failed++;
            }
          },
        );
      }
      return counts;
    },
    health: () => queue.health(),
  };
}
