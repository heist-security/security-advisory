import { describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { ingestion } from "../src/application/ingest";
import type {
  IngestionQueue,
  SourceReader,
  SourceJob,
} from "../src/application/ports";
import { connectionConfig } from "../src/adapters/postgres/client";
const options = {
  pollBatch: 1,
  collectBatch: 1,
  structuredBatch: 1,
  publisherBatch: 1,
  pollConcurrency: 1,
  collectConcurrency: 1,
  processConcurrency: 1,
  structuredIds: ["core-osv"],
  publisherIds: ["ruby"],
  hourlyBudget: 60,
};
function fixture() {
  const queue: IngestionQueue = {
    claimSource: vi.fn().mockResolvedValue(null),
    stage: vi.fn(),
    finishSource: vi.fn(),
    claimEntry: vi.fn().mockResolvedValue(null),
    finishEntry: vi.fn(),
    failEntry: vi.fn(),
    claimDocument: vi.fn().mockResolvedValue(null),
    failDocument: vi.fn(),
    health: vi.fn(),
  };
  const reader: SourceReader = {
    discover: vi.fn(),
    collect: vi.fn(),
    normalize: vi.fn(),
  };
  const publish = vi.fn();
  return {
    queue,
    reader,
    publish,
    app: ingestion(queue, reader, publish, options, () => new Date()),
  };
}
describe("application orchestration", () => {
  it("does not checkpoint an incompletely staged discovery", async () => {
    const { queue, reader, app } = fixture();
    const source = {
      id: "core-osv",
      lease_token: "lease",
      definition: {},
      etag: null,
      last_modified: null,
    } satisfies SourceJob;
    vi.mocked(queue.claimSource).mockResolvedValueOnce(source);
    vi.mocked(reader.discover).mockResolvedValue({
      entries: Array.from({ length: 501 }, (_, i) => ({
        url: "url" + i,
        fingerprint: String(i),
        item: {},
        feed_title: "OSV",
      })),
      checkpoint: { since: "new" },
      not_modified: false,
    });
    vi.mocked(queue.stage)
      .mockResolvedValueOnce()
      .mockRejectedValueOnce(new Error("private source text"));
    expect(await app.poll()).toMatchObject({ failed: 1, sources: 0 });
    expect(queue.finishSource).toHaveBeenCalledExactlyOnceWith(
      source,
      null,
      "collection_or_processing_failed",
    );
  });
  it("stages valid entries but reports partial discovery failure without saving validators", async () => {
    const { queue, reader, app } = fixture();
    const source = {
      id: "ruby",
      definition: {},
      lease_token: "lease",
      etag: '"old"',
      last_modified: null,
    };
    const entry = {
      url: "https://www.ruby-lang.org/en/news/test",
      fingerprint: "valid",
      item: {},
      feed_title: "Ruby",
    };
    vi.mocked(queue.claimSource).mockResolvedValueOnce(source);
    vi.mocked(reader.discover).mockResolvedValue({
      entries: [entry],
      not_modified: false,
      rejected_entries: 1,
      etag: '"new"',
    });
    expect(await app.poll()).toMatchObject({
      entries_staged: 1,
      failed: 1,
      sources: 0,
    });
    expect(queue.stage).toHaveBeenCalledExactlyOnceWith(source, [entry]);
    expect(queue.finishSource).toHaveBeenCalledExactlyOnceWith(
      source,
      null,
      "source_url_rejected",
    );
  });
  it("keeps structured claims outside the paid budget and skips disabled publishers", async () => {
    const { app, queue, reader, publish } = fixture();
    await app.process();
    expect(queue.claimDocument).toHaveBeenNthCalledWith(
      1,
      ["core-osv"],
      undefined,
    );
    expect(queue.claimDocument).toHaveBeenNthCalledWith(2, ["ruby"], 60);
    vi.mocked(queue.claimDocument).mockClear();
    await ingestion(
      queue,
      reader,
      publish,
      { ...options, publisherIds: [] },
      () => new Date(),
    ).process();
    expect(queue.claimDocument).toHaveBeenCalledExactlyOnceWith(
      ["core-osv"],
      undefined,
    );
    expect(reader.normalize).not.toHaveBeenCalled();
  });
});
it("keeps domain and application independent of adapters and Next.js", () => {
  for (const layer of ["domain", "application"]) {
    const directory = new URL("../src/" + layer + "/", import.meta.url);
    for (const file of readdirSync(directory).filter((f) =>
      f.endsWith(".ts"),
    )) {
      const code = readFileSync(new URL(file, directory), "utf8");
      for (const [, dependency] of code.matchAll(/from\s+["']([^"']+)["']/g)) {
        expect(dependency, layer + "/" + file).not.toMatch(
          /adapters|server|presentation|next|^pg$|openai/,
        );
        if (layer === "domain") expect(dependency).not.toContain("application");
      }
      expect(code).not.toMatch(/process\.env|\bfetch\(/);
    }
  }
});
it("verifies remote PostgreSQL certificates without URL options overriding TLS configuration", () => {
  const config = connectionConfig(
    "postgresql://user:password@db.example/db?sslmode=require&sslrootcert=untrusted&ssl=false",
    "pinned CA",
  );
  expect(config.ssl).toEqual({ rejectUnauthorized: true, ca: "pinned CA" });
  expect(config.connectionString).not.toContain("sslmode");
  expect(config.connectionString).not.toContain("sslrootcert");
  expect(new URL(config.connectionString!).searchParams.has("ssl")).toBe(false);
  expect(() =>
    connectionConfig("postgresql://db.example/db?sslmode=disable"),
  ).toThrow("TLS");
  expect(connectionConfig("postgresql://localhost/db").ssl).toBe(false);
});

it("uses one processing deadline across structured and paid work", async () => {
  const { queue, reader, publish } = fixture();
  let elapsed = 0;
  vi.mocked(queue.claimDocument).mockResolvedValueOnce({
    id: 1,
    source_id: "core-osv",
    source_url: "https://osv.dev/test",
    source_published_at: null,
    lease_token: "lease",
    body: "body",
  });
  vi.mocked(reader.normalize).mockImplementationOnce(async () => {
    elapsed = 180001;
    throw new Error("Slow provider");
  });
  await ingestion(
    queue,
    reader,
    publish,
    options,
    () => new Date(elapsed),
  ).process();
  expect(queue.claimDocument).toHaveBeenCalledTimes(1);
  expect(queue.failDocument).toHaveBeenCalled();
});
