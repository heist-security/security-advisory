import { afterEach, expect, it, vi } from "vitest";
import { events } from "../src/lib/events";
import { databaseFailureReason } from "../src/lib/errors";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it.each(["grouped", "events"] as const)(
  "logs safe diagnostics for failed %s reads and preserves the failure",
  async (view) => {
    vi.stubEnv("SUPABASE_URL", "https://database.example.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
    const error = {
      code: "57014",
      message: "private database diagnostic",
      details: "private source text",
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(error, { status: 400 })),
    );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(
      events({
        view,
        type: ["patch"],
        severity: ["critical"],
        q: "private query",
      }),
    ).rejects.toMatchObject(error);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0])).toEqual({
      operation: "feed_query",
      reason: "query_canceled",
      view,
      filters: ["q", "type", "severity"],
      updates: false,
      duration_ms: expect.any(Number),
    });
  },
);

it.each([
  [{ code: "55P03" }, "lock_timeout"],
  [{ code: "53300" }, "connection_limit"],
  [{ code: "PGRST003" }, "connection_timeout"],
  [{ code: "PGRST002" }, "database_unavailable"],
  [{ code: "PGRST202" }, "schema_mismatch"],
  [{ name: "TimeoutError" }, "timeout"],
  [
    { code: "private code", message: "private message" },
    "database_query_failed",
  ],
  [null, "database_query_failed"],
])(
  "classifies database failures without exposing diagnostics",
  (error, reason) => {
    expect(databaseFailureReason(error)).toBe(reason);
  },
);
