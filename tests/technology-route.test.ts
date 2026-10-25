import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/api/v1/technologies/route";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

it("finds prefix suggestions without recency sorting or loading advisory bodies", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
    Response.json([{ value: "ruby", label: "Ruby" }]),
  );
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(
    new Request("https://feed.example/api/v1/technologies?q=rub"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [{ value: "ruby", label: "Ruby" }],
  });
  expect(new URL(String(fetcher.mock.calls[0][0])).pathname).toBe(
    "/rest/v1/technology_catalog",
  );
  const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    select: "value:id,label",
    search_document: "fts(simple).(rub:*)",
    order: "label.asc,id.asc",
    limit: "50",
  });
});

it("uses the full catalog for initial suggestions and rejects invalid searches before querying", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json([]));
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await GET(new Request("https://feed.example/api/v1/technologies"))).status,
  ).toBe(200);
  expect(
    new URL(String(fetcher.mock.calls[0][0])).searchParams.get("order"),
  ).toBe("label.asc,id.asc");
  for (const q of ["q=ruby&q=node", "q=!!!", "q=" + "x".repeat(101)])
    expect(
      (await GET(new Request("https://feed.example/api/v1/technologies?" + q)))
        .status,
    ).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
