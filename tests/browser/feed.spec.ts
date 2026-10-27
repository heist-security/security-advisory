import { test, expect, type Route } from "@playwright/test";
import type { TechnologyPage } from "../../src/application/ports";
test.beforeEach(async ({ page }) => {
  await page.route("**/api/v1/risk?**", (route) =>
    route.fulfill({
      json: {
        availability: { epss: "available" },
        data: [
          { cve: "CVE-2026-53493", epss: { epss: 0.0036, date: "2026-10-26" } },
        ],
      },
    }),
  );
});
test("shows one card for matching patch fixes and keeps different fixes separate", async ({
  page,
}) => {
  await page.goto("/?type=patch");
  const cards = page.locator(".item-card");
  await expect(cards).toHaveCount(2);
  const combined = cards.filter({ hasText: "containerd security updates" });
  await expect(combined).toContainText("Fixed versions: 2.0.14, 2.4.1");
  await expect(cards.filter({ hasText: "containerd 3.0.0" })).toHaveCount(1);
  await combined
    .getByRole("link", { name: "containerd security updates" })
    .click();
  await expect(page).toHaveURL(/\/items\/[a-f0-9]{64}/);
  await expect(
    page.getByRole("heading", { name: "Source evidence" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Original source/ })).toHaveCount(
    2,
  );
  await page.getByRole("link", { name: "Back to feed" }).click();
  await expect(page).toHaveURL(/type=patch/);
});
test("search, filters, pagination and subscription links share the flat item contract", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await expect(page.locator(".item-card")).toHaveCount(20);
  await page.getByRole("link", { name: "Older items", exact: true }).click();
  await expect(page).toHaveURL(/before=/);
  await expect(page.locator(".item-card")).toHaveCount(7);
  await page
    .getByRole("searchbox", { name: "Search feed" })
    .fill("CVE-2026-53493");
  await expect(page).toHaveURL(/q=CVE-2026-53493/);
  await expect(page).not.toHaveURL(/before=/);
  await expect(page.locator(".item-card")).toHaveCount(1);
  const json = await page
    .getByRole("link", { name: "JSON", exact: true })
    .getAttribute("href");
  expect(json).toBe("/api/v1/items?q=CVE-2026-53493");
  const result = await request.get(json!);
  expect(result.headers()["cache-control"]).toBe("no-store");
  const { data } = await result.json();
  expect(data).toHaveLength(1);
  expect(data[0].fixed_versions).toEqual(["2.0.14", "2.4.1"]);
  const rss = await request.get("/feed.xml?q=CVE-2026-53493");
  expect(await rss.text()).toContain("heist-item:" + data[0].id);
});
test("serves current-state cursors, sitemap and validation errors", async ({
  request,
  page,
}) => {
  const response = await request.get("/api/v1/items?after=0&limit=100");
  const body = await response.json();
  expect(body.schema_version).toBe("1");
  expect(body.data).toHaveLength(27);
  expect(
    body.data.every(
      (item: { id: unknown; cursor: unknown }) =>
        typeof item.id === "string" && typeof item.cursor === "number",
    ),
  ).toBe(true);
  const empty = await request.get("/api/v1/items?after=" + body.next_after);
  expect((await empty.json()).data).toEqual([]);
  expect((await request.get("/api/v1/items?view=grouped")).status()).toBe(400);
  expect((await request.get("/api/v1/events")).status()).toBe(404);
  expect((await request.get("/api/cron/process")).status()).toBe(401);
  expect((await request.get("/sitemap.xml?part=0")).status()).toBe(200);
  expect(await (await request.get("/sitemap.xml?part=0")).text()).toContain(
    "/items/",
  );
  await page.goto("/items/" + "0".repeat(64));
  await expect(
    page.getByRole("heading", { name: "Page not found" }),
  ).toBeVisible();
  await page.goto("/docs");
  await expect(
    page.getByRole("heading", { name: "API documentation" }),
  ).toBeVisible();
});

test("versioned product links keep the originating item in the filtered feed", async ({
  page,
}) => {
  await page.goto("/?q=Older+advisory+24");
  await expect(page.locator(".item-card")).toHaveCount(1);
  await page
    .getByRole("link", { name: "Acme Server 4.2", exact: true })
    .click();
  await expect(page).toHaveURL(/[?&]technology=acme-server(?:&|$)/);
  await expect(page.locator(".item-card")).toHaveCount(1);
  await expect(
    page.getByRole("heading", { name: "Older advisory 24", exact: true }),
  ).toBeVisible();
});

test("keeps the feed usable while technology suggestions are loading", async ({
  page,
}) => {
  let requests = 0;
  let resolveRequest!: (route: Route) => void;
  const lookup = new Promise<Route>((resolve) => {
    resolveRequest = resolve;
  });
  await page.route("**/api/v1/technologies?**", (route) => {
    requests++;
    resolveRequest(route);
  });
  await page.goto("/?technology=containerd");
  await expect(page.locator(".item-card")).toHaveCount(20);
  expect(requests).toBe(0);
  await page.getByRole("button", { name: "Technology (1)" }).click();
  const route = await lookup;
  await expect(page.getByText("Searching…", { exact: true })).toBeVisible();
  await expect(page.locator(".item-card")).toHaveCount(20);
  await expect(
    page.getByRole("button", { name: "Remove containerd", exact: true }),
  ).toBeVisible();
  await route.fulfill({
    json: {
      data: [{ value: "containerd", label: "containerd" }],
      next_after: null,
    },
  });
  await expect(
    page.getByRole("checkbox", { name: "containerd", exact: true }),
  ).toBeChecked();
});

test("paginates technology suggestions, retries a page and starts each search at the beginning", async ({
  page,
}) => {
  let moreAttempts = 0;
  const searches: { q: string; after: string | null }[] = [];
  await page.route("**/api/v1/technologies?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    const q = params.get("q") ?? "",
      after = params.get("after");
    searches.push({ q, after });
    if (q === "nodejs")
      return route.fulfill({
        json: {
          data: [{ value: "node-js", label: "Node.js" }],
          next_after: null,
        },
      });
    if (after) {
      if (++moreAttempts === 1)
        return route.fulfill({ status: 503, json: { error: "unavailable" } });
      return route.fulfill({
        json: {
          data: [{ value: "containerd", label: "containerd" }],
          next_after: null,
        },
      });
    }
    await route.fulfill({
      json: {
        data: [{ value: "acme-server", label: "Acme Server" }],
        next_after: "acme-server",
      },
    });
  });
  await page.goto("/?technology=containerd");
  await page.getByRole("button", { name: "Technology (1)" }).click();
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  await expect(
    page.getByRole("checkbox", { name: "Acme Server", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Retry suggestions", exact: true })
    .click();
  await expect(
    page.getByRole("checkbox", { name: "containerd", exact: true }),
  ).toBeChecked();
  await expect(
    page
      .getByRole("group", { name: "Technologies", exact: true })
      .getByRole("checkbox"),
  ).toHaveCount(2);
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("searchbox", { name: "Search technologies" })
    .fill("nodejs");
  await expect(
    page.getByRole("checkbox", { name: "Node.js", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Acme Server", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Remove containerd", exact: true }),
  ).toBeVisible();
  expect(searches).toEqual([
    { q: "", after: null },
    { q: "", after: "acme-server" },
    { q: "", after: "acme-server" },
    { q: "nodejs", after: null },
  ]);
});

test("ignores an old technology page after the search changes", async ({
  page,
}) => {
  let resolvePage!: (route: Route) => void;
  const delayed = new Promise<Route>((resolve) => {
    resolvePage = resolve;
  });
  await page.route("**/api/v1/technologies?**", async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (params.get("q") === "nodejs")
      return route.fulfill({
        json: {
          data: [{ value: "node-js", label: "Node.js" }],
          next_after: null,
        },
      });
    if (params.has("after")) {
      resolvePage(route);
      return;
    }
    await route.fulfill({
      json: {
        data: [{ value: "acme-server", label: "Acme Server" }],
        next_after: "acme-server",
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Technology", exact: true }).click();
  await page.getByRole("button", { name: "Load more", exact: true }).click();
  const oldPage = await delayed;
  await page
    .getByRole("searchbox", { name: "Search technologies" })
    .fill("nodejs");
  await expect(
    page.getByRole("checkbox", { name: "Node.js", exact: true }),
  ).toBeVisible();
  await oldPage
    .fulfill({
      json: {
        data: [{ value: "obsolete-result", label: "Obsolete result" }],
        next_after: "obsolete-result",
      },
    })
    .catch(() => {});
  await expect(
    page.getByRole("checkbox", { name: "Obsolete result", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Load more", exact: true }),
  ).toHaveCount(0);
});

test("serves distinct database technology pages and searches identifiers", async ({
  request,
}) => {
  const values: string[] = [];
  let after: string | null = null;
  for (let page = 0; page < 3; page++) {
    const result = await request.get(
      "/api/v1/technologies?limit=1" + (after ? "&after=" + after : ""),
    );
    expect(result.status()).toBe(200);
    const body: TechnologyPage = await result.json();
    expect(body.data).toHaveLength(1);
    values.push(body.data[0].value);
    after = body.next_after;
  }
  expect(values).toEqual([
    "acme-server",
    "containerd",
    "github-containerd-containerd",
  ]);
  expect(after).toBeNull();
  const result = await request.get("/api/v1/technologies?q=ontainerd&limit=1");
  expect((await result.json()).data[0].value).toBe("containerd");
});
