import { test, expect } from "@playwright/test";
test("source pages are bounded and repeated query parameters never crash", async ({
  page,
  request,
}) => {
  const response = await request.get("/sources?q=ruby&q=node");
  expect(response.status()).toBe(200);
  await page.goto("/sources");
  await expect(page.locator(".source-row")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "OSV", exact: true }),
  ).toBeVisible();
  const first = page.locator(".source-row").first();
  await first
    .getByRole("button", { name: /Scope and verification notes/ })
    .click();
  await expect(first.locator(".source-check")).toBeVisible();
  await expect(first.locator(".source-check")).toContainText(
    "Structured adapter",
  );
  await expect(first.locator(".source-check time")).toHaveCount(0);
  await expect(
    first.getByRole("link", { name: /Data documentation/ }),
  ).toBeVisible();
  await first
    .getByRole("button", { name: /Scope and verification notes/ })
    .click();
  await page
    .getByRole("link", { name: "Optional vendor catalog", exact: true })
    .click();
  await expect(page.locator(".source-row")).toHaveCount(24);
  await page.getByRole("link", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  await expect(page).toHaveURL(/catalog=vendor/);
});
test("public errors are bounded and protected operations fail closed", async ({
  request,
}) => {
  expect((await request.get("/api/v1/events?limit=101")).status()).toBe(400);
  expect(
    (await request.get("/api/v1/events?type=patch&type=advisory")).status(),
  ).toBe(400);
  expect((await request.get("/feed.xml?after=1")).status()).toBe(400);
  for (const path of ["poll", "collect", "process", "health"])
    expect((await request.get("/api/cron/" + path)).status()).toBe(401);
  const catalog = await (await request.get("/api/v1/sources")).json();
  expect(catalog.data).toHaveLength(3);
  expect((await request.get("/")).headers()["x-content-type-options"]).toBe(
    "nosniff",
  );
});

test("JSON and RSS keep corrections in filtered subscriptions and support archive cursors", async ({
  request,
}) => {
  const path = "/api/v1/events?technology=node-js&type=patch";
  const response = await request.get(path);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.data.map((event: { id: number }) => event.id)).toEqual([2, 1]);
  expect(body.data[0].payload.kind).toBe("withdrawal");
  const first = await (await request.get(path + "&after=0&limit=1")).json();
  expect(first.data[0].id).toBe(1);
  expect(first.next_after).toBe(1);
  const next = await (
    await request.get(path + "&after=" + first.next_after)
  ).json();
  expect(next.data.map((event: { id: number }) => event.id)).toEqual([2]);
  const rss = await request.get("/feed.xml?type=patch&technology=node-js");
  expect(rss.status()).toBe(200);
  expect(await rss.text()).toContain("Previous extraction withdrawn");
  expect(await rss.text()).not.toContain("Ruby advisory");
});
