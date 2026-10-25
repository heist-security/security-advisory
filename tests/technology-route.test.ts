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
    Response.json([
      { technologies: ["ruby"], products: [{ name: { value: "Ruby" } }] },
      { technologies: ["old-ruby"], products: null },
    ]),
  );
  vi.stubGlobal("fetch", fetcher);
  const response = await GET(
    new Request("https://feed.example/api/v1/technologies?q=rub"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    data: [
      { value: "old-ruby", label: "old-ruby" },
      { value: "ruby", label: "Ruby" },
    ],
  });
  const params = new URL(String(fetcher.mock.calls[0][0])).searchParams;
  expect(Object.fromEntries(params)).toEqual({
    select: "technologies,products:payload->products",
    search_document: "fts(simple).(rub:*)",
    order: "technologies.asc",
    limit: "100",
  });
});

it("keeps the initial suggestion list recent and rejects invalid searches before querying", async () => {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  const fetcher = vi.fn(async (_input: RequestInfo | URL) => Response.json([]));
  vi.stubGlobal("fetch", fetcher);
  expect(
    (await GET(new Request("https://feed.example/api/v1/technologies"))).status,
  ).toBe(200);
  expect(
    new URL(String(fetcher.mock.calls[0][0])).searchParams.get("order"),
  ).toBe("id.desc");
  for (const q of ["q=ruby&q=node", "q=!!!", "q=" + "x".repeat(101)])
    expect(
      (await GET(new Request("https://feed.example/api/v1/technologies?" + q)))
        .status,
    ).toBe(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
