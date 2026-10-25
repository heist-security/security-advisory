import { afterEach, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";
import { parseOptions, recollectOsv } from "../scripts/recollect-osv";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

function database(responses: unknown[]) {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json(responses.shift()),
  );
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

it("requires an explicit scope and defaults to previewing a single advisory", async () => {
  for (const args of [
    [],
    ["--apply"],
    ["--all", "--id=OSV-1"],
    ["--id=OSV-1", "--id=OSV-2"],
    ["--id=../../"],
    ["--id="],
    ["--unknown"],
  ])
    expect(() => parseOptions(args)).toThrow();
  const fetch = database([[{ id: 7 }], [{ id: 7, fingerprint: "original" }]]);
  expect(
    await recollectOsv(db(), parseOptions(["--id=CGA-p5j4-h8gr-5xgh"])),
  ).toEqual({
    mode: "dry-run",
    selected: 1,
    queued: 0,
  });
  for (const [url, init] of fetch.mock.calls) {
    expect(init?.method).toBe("GET");
    expect(new URL(String(url)).searchParams.get("source_url")).toBe(
      "eq.https://osv.dev/vulnerability/CGA-p5j4-h8gr-5xgh",
    );
  }
});

it("walks a frozen ID range and fences entries changed or claimed during recollection", async () => {
  const fetch = database([
    [{ id: 9 }],
    [
      { id: 2, fingerprint: "old" },
      { id: 5, fingerprint: "current" },
    ],
    [], // Concurrent poll/claim changed entry 2; conditional update is a no-op.
    [{ id: 5 }],
    [{ id: 9, fingerprint: "last" }],
    [{ id: 9 }],
  ]);
  expect(await recollectOsv(db(), parseOptions(["--all", "--apply"]))).toEqual({
    mode: "apply",
    selected: 3,
    queued: 2,
  });
  const pages = fetch.mock.calls
    .filter(([, init]) => init?.method === "GET")
    .slice(1);
  expect(
    pages.map(([url]) => new URL(String(url)).searchParams.getAll("id")),
  ).toEqual([
    ["gt.0", "lte.9"],
    ["gt.5", "lte.9"],
  ]);
  const writes = fetch.mock.calls.filter(
    ([, init]) => init?.method === "PATCH",
  );
  expect(writes).toHaveLength(3);
  for (const [url, init] of writes) {
    const params = new URL(String(url)).searchParams;
    expect(params.get("source_id")).toBe("eq.core-osv");
    expect(params.get("status")).toBe("eq.done");
    expect(params.get("fingerprint")).toMatch(/^eq\.(old|current|last)$/);
    expect(JSON.parse(String(init?.body))).toMatchObject({
      status: "pending",
      attempts: 0,
      lease_token: null,
      leased_until: null,
    });
  }
});

it("does no work when there are no completed OSV entries", async () => {
  const fetch = database([[]]);
  expect(await recollectOsv(db(), parseOptions(["--all", "--apply"]))).toEqual({
    mode: "apply",
    selected: 0,
    queued: 0,
  });
  expect(fetch).toHaveBeenCalledTimes(1);
});
