import { load } from "cheerio";
import { afterEach, expect, it, vi } from "vitest";
import { GET } from "../src/app/sitemap.xml/route";
import robots from "../src/app/robots";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

type Group = { id: string; latest_update_id: number; active: boolean };
function database(rows: Group[] = [], cap = 1000) {
  vi.stubEnv("SUPABASE_URL", "https://database.example.test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-placeholder");
  vi.stubEnv("PUBLIC_BASE_URL", "https://feed.example.test/");
  const fetch = vi.fn(async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.pathname === "/rest/v1/rpc/advisory_sitemap_parts")
      return Response.json(
        [
          ...new Set(
            rows
              .filter((row) => row.active)
              .map((row) => Math.floor((row.latest_update_id - 1) / 1000)),
          ),
        ].sort((a, b) => a - b),
      );
    expect(url.pathname).toBe("/rest/v1/advisory_groups");
    const params = url.searchParams;
    expect(params.get("select")).toMatch(/^(id,)?latest_update_id$/);
    const data = rows
      .filter((row) => {
        if (params.get("active") === "eq.true" && !row.active) return false;
        return params.getAll("latest_update_id").every((filter) => {
          const [op, value] = filter.split(".");
          if (op === "gt") return row.latest_update_id > Number(value);
          if (op === "lte") return row.latest_update_id <= Number(value);
          return true;
        });
      })
      .sort((a, b) =>
        params.get("order")?.startsWith("latest_update_id.desc")
          ? b.latest_update_id - a.latest_update_id
          : a.latest_update_id - b.latest_update_id,
      )
      .slice(0, Math.min(Number(params.get("limit")), cap));
    return Response.json(data);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}
function request(query = "") {
  return new Request("https://untrusted-host.example/sitemap.xml" + query);
}
function locations(xml: string) {
  return load(xml, { xml: true })("loc")
    .map((_, element) => load(element).text())
    .get();
}
function group(id: number, active = true): Group {
  return {
    id: "advisory:00000000-0000-0000-0000-" + String(id).padStart(12, "0"),
    latest_update_id: id,
    active,
  };
}

it("advertises the configured origin and covers an archive beyond 50,000 updates", async () => {
  database([group(1), group(50_001), group(90_000, false)]);
  expect(robots().sitemap).toBe("https://feed.example.test/sitemap.xml");
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("Content-Type")).toContain("application/xml");
  expect(response.headers.get("Cache-Control")).toContain("s-maxage=3600");
  const xml = await response.text();
  expect(load(xml, { xml: true })("sitemapindex > sitemap")).toHaveLength(3);
  expect(locations(xml)).toEqual([
    "https://feed.example.test/sitemap.xml?part=pages",
    "https://feed.example.test/sitemap.xml?part=0",
    "https://feed.example.test/sitemap.xml?part=50",
  ]);
});

it("paginates through a lower database row cap without losing archive entries at part boundaries", async () => {
  const rows = Array.from({ length: 1002 }, (_, i) => group(i + 1));
  rows[1].active = false;
  rows[2].id = "osv:GHSA-7x63-xv5r-3p2x";
  database(rows, 250);
  const first = await GET(request("?part=0"));
  const second = await GET(request("?part=1"));
  const urls = [
    ...locations(await first.text()),
    ...locations(await second.text()),
  ];
  expect(urls).toEqual(
    rows
      .filter((row) => row.active)
      .map(
        (row) =>
          "https://feed.example.test/advisories/" + encodeURIComponent(row.id),
      ),
  );
  expect(new Set(urls).size).toBe(1001);
  expect(urls.every((url) => !url.includes("?"))).toBe(true);
});

it("lists the main pages once and supports an empty archive", async () => {
  const fetch = database();
  const pages = await GET(request("?part=pages"));
  expect(locations(await pages.text())).toEqual([
    "https://feed.example.test/",
    "https://feed.example.test/sources",
    "https://feed.example.test/docs",
  ]);
  expect(fetch).not.toHaveBeenCalled();
  expect(locations(await (await GET(request())).text())).toEqual([
    "https://feed.example.test/sitemap.xml?part=pages",
  ]);
  const empty = await GET(request("?part=0"));
  expect(empty.status).toBe(404);
  expect(empty.headers.get("Cache-Control")).toBe("no-store");
});

it("reflects new advisories and retired groups on subsequent origin requests", async () => {
  const rows = [group(1)];
  database(rows);
  expect(locations(await (await GET(request("?part=0"))).text())).toHaveLength(
    1,
  );
  rows[0].active = false;
  rows.push(group(1001));
  expect(locations(await (await GET(request("?part=0"))).text())).toEqual([]);
  expect(locations(await (await GET(request())).text())).toContain(
    "https://feed.example.test/sitemap.xml?part=1",
  );
  expect(locations(await (await GET(request("?part=1"))).text())).toEqual([
    "https://feed.example.test/advisories/" + encodeURIComponent(rows[1].id),
  ]);
});

it("escapes URLs as XML without changing their parsed value", async () => {
  database();
  vi.stubEnv("PUBLIC_BASE_URL", "https://feed.example.test/a&b");
  const xml = await (await GET(request())).text();
  expect(xml).toContain("a&amp;b/sitemap.xml");
  expect(locations(xml)).toEqual([
    "https://feed.example.test/a&b/sitemap.xml?part=pages",
  ]);
});

it("rejects malformed parts before querying the database", async () => {
  const fetch = database();
  for (const query of [
    "?part=",
    "?part=-1",
    "?part=01",
    "?part=1.5",
    "?part=49999",
    "?part=9007199254740992",
    "?part=0&part=1",
    "?unexpected=1",
  ]) {
    const response = await GET(request(query));
    expect(response.status).toBe(400);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
  }
  expect(fetch).not.toHaveBeenCalled();
});

it("returns uncached retryable errors instead of publishing incomplete sitemaps", async () => {
  const fetch = database();
  fetch.mockImplementation(async () =>
    Response.json({ message: "Database query failed" }, { status: 400 }),
  );
  for (const query of ["", "?part=0"]) {
    const response = await GET(request(query));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("Retry-After")).toBe("60");
  }
  fetch.mockReset();
  fetch.mockResolvedValueOnce(Response.json([group(1)]));
  fetch.mockResolvedValueOnce(Response.json({}, { status: 400 }));
  expect((await GET(request("?part=0"))).status).toBe(503);
  vi.stubEnv("SUPABASE_URL", "");
  expect((await GET(request())).status).toBe(503);
});
