import { test, expect } from "@playwright/test";
test("visual reader displays the shared stream and expands source evidence", async ({
  page,
}, info) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Security feed.",
  );
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS" }),
  ).toHaveAttribute("href", "/feed.xml");
  await page.screenshot({ path: "test-results/" + info.project.name + "-visual-reader.png", fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const patch = page.locator("#event-1");
  await patch.getByText("Evidence and details", { exact: false }).click();
  await expect(
    patch.getByText("Fixed versions", { exact: true }),
  ).toBeVisible();
  await expect(
    patch.locator("blockquote").filter({ hasText: "Fixed in 99.0.1." }).last(),
  ).toBeVisible();
  const correction = page.locator("#event-2");
  await correction.getByText("Evidence and details", { exact: false }).click();
  await expect(
    correction.getByText("Correction to Heist’s extraction", { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/" + info.project.name + "-visual-reader.png",
    fullPage: true,
  });
});
test("search and filters persist in the URL and subscription formats", async ({
  page,
  request,
}) => {
  await page.goto("/feed");
  await page.getByLabel("Search announcements", { exact: true }).fill("Ruby");
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator(".event-card h3")).toContainText("Ruby advisory");
  await expect(page.locator(".format-links a").nth(1)).toHaveAttribute(
    "href",
    "/feed.xml?q=Ruby",
  );
  const data = await (await request.get("/api/v1/events?q=Ruby")).json();
  expect(data.data.map((event: { id: number }) => event.id)).toEqual([3]);
  await page.getByRole("link", { name: "Remove Search filter" }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
  await page
    .getByRole("navigation", { name: "Event types" })
    .getByRole("link", { name: "Patches" })
    .click();
  await page.locator(".refine-panel summary").click();
  await page.getByLabel("Technology", { exact: true }).fill("Node.js");
  await page.getByLabel("CVE", { exact: true }).fill("CVE-2026-12345");
  await page.getByRole("button", { name: "Apply filters" }).click();
  await expect(page.locator(".event-card")).toHaveCount(2);
  await expect(page.locator("#event-2")).toBeVisible();
  await expect(page.locator(".format-links a").nth(1)).toHaveAttribute(
    "href",
    "/feed.xml?type=patch&technology=node-js&cve=CVE-2026-12345",
  );
  await page.reload();
  await expect(page.getByLabel("Technology", { exact: true })).toHaveValue(
    "node-js",
  );
  await expect(page.locator(".event-card")).toHaveCount(2);
});
test("cursor navigation retains filters and does not offer an empty extra page", async ({
  page,
}) => {
  await page.goto("/feed?type=patch&limit=1");
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-2")).toBeVisible();
  await page.getByRole("link", { name: "Older events", exact: false }).click();
  await expect(page).toHaveURL(/before=2/);
  await expect(page.locator("#event-1")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Older events", exact: false }),
  ).toHaveCount(0);
  await page
    .getByRole("link", { name: "Back to latest events", exact: true })
    .click();
  await expect(page).not.toHaveURL(/before=/);
  await expect(page.locator(".event-card")).toHaveCount(2);
});
test("empty, invalid and unavailable states offer useful recovery", async ({
  page,
}) => {
  await page.goto("/feed?q=NoSuchTechnology");
  await expect(
    page.getByRole("heading", { name: "No events match these filters." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear all", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
  await page.goto("/feed?type=invalid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid event type",
  );
  await page.goto("/feed?source=fixture-unavailable");
  await expect(
    page.getByRole("heading", { name: "The feed is temporarily unavailable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try again", exact: false }),
  ).toBeVisible();
});
test("the landing page and navigation expose the visual feed", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("link", { name: "Browse the feed →", exact: true })
    .click();
  await expect(page).toHaveURL(/\/feed$/);
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Feed", exact: true }),
  ).toHaveAttribute("href", "/feed");
});
