import { afterEach, expect, it, vi } from "vitest";
import { db } from "../src/lib/db";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("reads current database state without Next fetch caching", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const mocked = vi.fn().mockImplementation(async () => Response.json([]));
  vi.stubGlobal("fetch", mocked);
  const caller = new AbortController();
  await db().from("events").select("id").abortSignal(caller.signal);
  const options = mocked.mock.calls[0][1];
  expect(options.cache).toBe("no-store");
  expect(options.signal.aborted).toBe(false);
  caller.abort();
  expect(options.signal.aborted).toBe(true);
});
