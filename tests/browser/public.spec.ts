import { test, expect } from "@playwright/test";
test("unified feed filters update both subscription formats without layout overflow", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "One place to listen.",
  );
  await page.getByLabel("Technology", { exact: true }).fill("Node.js");
  await page.getByLabel("CVE", { exact: true }).fill("CVE-2026-12345");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".feed-links a").first()).toHaveAttribute(
    "href",
    "/feed.xml?technology=node-js&cve=CVE-2026-12345",
  );
  await expect(page.locator(".feed-links a").nth(1)).toHaveAttribute(
    "href",
    "/api/v1/events?technology=node-js&cve=CVE-2026-12345",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + info.project.name + "-feed.png",
    fullPage: true,
  });
});
test("source pages are bounded and repeated query parameters never crash", async ({
  page,
  request,
}, info) => {
  const response = await request.get("/sources?q=ruby&q=node");
  expect(response.status()).toBe(200);
  await page.goto("/sources");
  await expect(page.locator(".source-card")).toHaveCount(24);
  await page.getByRole("link", { name: "Next →", exact: true }).click();
  await expect(page).toHaveURL(/page=2/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + info.project.name + "-sources.png",
    fullPage: true,
  });
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
  expect(catalog.data).toHaveLength(24);
  expect((await request.get("/")).headers()["x-content-type-options"]).toBe(
    "nosniff",
  );
});
