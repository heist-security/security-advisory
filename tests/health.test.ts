import { afterEach, beforeEach, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/lib/db", () => ({ db: () => ({ rpc }) }));
import { GET } from "../src/app/api/cron/health/route";
const secret = "a-test-secret-with-at-least-32-characters";
const healthy = {
  sources_failing: 0, sources_overdue: 0, collection_failed: 0,
  extraction_failed: 0, collection_oldest_seconds: 0, extraction_oldest_seconds: 0,
};
beforeEach(() => vi.stubEnv("CRON_SECRET", secret));
afterEach(() => { vi.unstubAllEnvs(); vi.resetAllMocks(); });
it("reports source failures even during their retry backoff", async () => {
  rpc.mockResolvedValue({ data: { ...healthy, sources_failing: 1 }, error: null });
  const response = await GET(new Request("https://example.org/api/cron/health", { headers: { authorization: "Bearer " + secret } }));
  expect(response.status).toBe(503);
  expect((await response.json()).status).toBe("degraded");
});
it("returns a private healthy response only with a valid bearer secret", async () => {
  expect((await GET(new Request("https://example.org/api/cron/health"))).status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
  rpc.mockResolvedValue({ data: healthy, error: null });
  const response = await GET(new Request("https://example.org/api/cron/health", { headers: { authorization: "Bearer " + secret } }));
  expect(response.status).toBe(200);
  expect(response.headers.get("Cache-Control")).toBe("no-store");
});
