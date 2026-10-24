import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { rpc, sources } = vi.hoisted(() => ({ rpc: vi.fn(), sources: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: () => ({ rpc, from: () => ({ select: () => ({ in: sources }) }) }),
}));
import { GET } from "../src/app/api/cron/health/route";
const secret = "a-test-secret-with-at-least-32-characters";
const healthy = {
  sources_failing: 0,
  sources_overdue: 0,
  collection_failed: 0,
  extraction_failed: 0,
  collection_oldest_seconds: 0,
  extraction_oldest_seconds: 0,
};
beforeEach(() => {
  vi.stubEnv("CRON_SECRET", secret);
  sources.mockResolvedValue({
    data: ["core-osv", "core-cve", "core-kev"].map((id) => ({
      id,
      enabled: true,
      verification: { sync: { since: "2026-10-24T10:00:00Z" } },
    })),
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it("reports source failures even during their retry backoff", async () => {
  rpc.mockResolvedValue({
    data: { ...healthy, sources_failing: 1 },
    error: null,
  });
  const response = await GET(
    new Request("https://example.org/api/cron/health", {
      headers: { authorization: "Bearer " + secret },
    }),
  );
  expect(response.status).toBe(503);
  expect((await response.json()).status).toBe("degraded");
});
it("returns a private healthy response only with a valid bearer secret", async () => {
  expect(
    (await GET(new Request("https://example.org/api/cron/health"))).status,
  ).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: healthy, error: null });
  const response = await GET(
    new Request("https://example.org/api/cron/health", {
      headers: { authorization: "Bearer " + secret },
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});

it("reports missing structured source configuration as degraded", async () => {
  rpc.mockResolvedValue({ data: healthy });
  sources.mockResolvedValue({ data: [] });
  const response = await GET(
    new Request("https://example.org/api/cron/health", {
      headers: { authorization: "Bearer " + secret },
    }),
  );
  expect(response.status).toBe(503);
  expect((await response.json()).structured_sources_configured).toBe(false);
});
