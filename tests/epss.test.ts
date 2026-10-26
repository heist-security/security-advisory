import { afterEach, expect, it, vi } from "vitest";
import { epssPercent, loadEpss } from "../src/lib/epss";

afterEach(() => vi.unstubAllGlobals());
const signal = () => new AbortController().signal;

it("deduplicates and batches visible CVEs with bounded concurrency", async () => {
  const ids = Array.from({ length: 130 }, (_, i) => `CVE-2026-${10000 + i}`);
  let active = 0,
    peak = 0;
  const fetcher = vi.fn(async (url: string) => {
    active++;
    peak = Math.max(peak, active);
    const batch = new URL(url, "https://feed.example").searchParams
      .get("cve")!
      .split(",");
    expect(batch.length).toBeLessThanOrEqual(40);
    await Promise.resolve();
    active--;
    return Response.json({
      availability: { epss: "available" },
      data: batch.map((cve) => ({
        cve,
        epss: { cve, epss: 0, percentile: 0, date: "2026-10-26" },
      })),
    });
  });
  vi.stubGlobal("fetch", fetcher);
  const scores = await loadEpss([...ids, ...ids], signal());
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(peak).toBe(3);
  expect(Object.keys(scores)).toHaveLength(130);
  expect(scores[ids[0]]?.epss).toBe(0);
});

it("preserves missing and failed batches without discarding successful scores", async () => {
  const ids = Array.from({ length: 81 }, (_, i) => `CVE-2026-${10000 + i}`);
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockRejectedValueOnce(new Error("Network failure"))
      .mockResolvedValueOnce(
        Response.json({
          availability: { epss: "available" },
          data: [
            {
              cve: ids[40],
              epss: {
                cve: ids[40],
                epss: 0.123,
                percentile: 0.9,
                date: "2026-10-26",
              },
            },
          ],
        }),
      )
      .mockResolvedValueOnce(Response.json({}, { status: 503 })),
  );
  const scores = await loadEpss(ids, signal());
  expect(scores[ids[0]]).toBeNull();
  expect(scores[ids[40]]?.epss).toBe(0.123);
  expect(scores[ids[41]]).toBeNull();
  expect(scores[ids[80]]).toBeNull();
});

it("handles a partial provider outage and skips empty or cancelled lookups", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      Response.json({ availability: { epss: "unavailable" }, data: [] }),
    );
  vi.stubGlobal("fetch", fetcher);
  expect(await loadEpss(["CVE-2026-12345"], signal())).toEqual({
    "CVE-2026-12345": null,
  });
  await loadEpss([], signal());
  await loadEpss(["CVE-2026-54321"], AbortSignal.abort());
  expect(fetcher).toHaveBeenCalledTimes(1);
});

it.each([
  [0, "0.00%"],
  [0.000001, "<0.01%"],
  [0.0001, "0.01%"],
  [0.0042, "0.42%"],
  [0.123, "12.3%"],
  [1, "100.0%"],
])("formats probability %s as %s", (score, label) => {
  expect(epssPercent(score)).toBe(label);
});
