import { test, expect } from "@playwright/test";

test("feed search applies after typing stops and clearing restores the feed", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  const search = page.getByRole("searchbox", {
    name: "Search feed",
    exact: true,
  });
  await search.fill("Ru");
  await page.clock.runFor(200);
  await search.fill("Ruby ");
  await page.clock.runFor(299);
  await expect(page).toHaveURL("/");
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/q=Ruby/);
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-3")).toBeVisible();
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Ruby ");
  await search.pressSequentially("advisory");
  await page.clock.runFor(300);
  await expect(page).toHaveURL(/q=Ruby\+advisory/);
  await expect(page.locator("#event-3")).toBeVisible();
  await search.fill("");
  await page.clock.runFor(300);
  await expect(page).toHaveURL("/");
  await expect(page.locator(".event-card")).toHaveCount(4);
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml");
});

test("a selection includes pending search text and resets the feed cursor", async ({
  page,
}) => {
  await page.goto("/?source=nodejs&limit=1&before=2");
  await expect(page.locator("#event-1")).toBeVisible();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page
    .getByRole("searchbox", { name: "Search feed", exact: true })
    .fill("fictional");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("withdrawal");
  await expect(page).toHaveURL(/type=withdrawal/);
  expect(new URL(page.url()).searchParams.get("source")).toBe("nodejs");
  expect(new URL(page.url()).searchParams.get("q")).toBe("fictional");
  expect(new URL(page.url()).searchParams.has("before")).toBe(false);
  await page.clock.runFor(300);
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-2")).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Type", exact: true }),
  ).toHaveValue("withdrawal");
});

test("technology suggestions do not apply until selected, and deselecting clears filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".technology-filter summary").click();
  await page.getByLabel("Search technologies", { exact: true }).fill("Ruby");
  const ruby = page.getByRole("checkbox", { name: "Ruby", exact: true });
  await expect(ruby).toBeVisible();
  await expect(page).toHaveURL("/");
  await ruby.check();
  await expect(page).toHaveURL(/technology=ruby/);
  await expect(page.locator("#event-3")).toBeVisible();
  await ruby.uncheck();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".event-card")).toHaveCount(4);
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await page.locator(".severity-filter summary").click();
  const critical = page.getByRole("checkbox", {
    name: "Critical",
    exact: true,
  });
  await critical.check();
  await expect(page).toHaveURL(/severity=critical/);
  await critical.uncheck();
  await expect(page).toHaveURL("/");
  await expect(page.locator(".event-card")).toHaveCount(4);
});

test("source filters apply automatically and keep the selected catalog", async ({
  page,
}) => {
  await page.goto("/sources?catalog=vendor&page=2");
  await expect(
    page.getByRole("button", { name: "Filter", exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole("combobox", { name: "Channel", exact: true })
    .selectOption("release-notes");
  await expect(page).toHaveURL(/channel=release-notes/);
  expect(new URL(page.url()).searchParams.get("catalog")).toBe("vendor");
  expect(new URL(page.url()).searchParams.has("page")).toBe(false);
  await expect(page.locator(".source-row").first()).toBeVisible();
  for (const channel of await page.locator(".source-channel").allTextContents())
    expect(channel).toBe("Release notes");
  const category = await page.locator(".source-category").first().textContent();
  await page
    .getByRole("combobox", { name: "Category", exact: true })
    .selectOption(category!);
  await expect
    .poll(() => new URL(page.url()).searchParams.get("category"))
    .toBe(category);
  for (const value of await page.locator(".source-category").allTextContents())
    expect(value).toBe(category);
  await page
    .getByRole("textbox", { name: "Search", exact: true })
    .fill("NoSuchSource");
  await expect(page).toHaveURL(/q=NoSuchSource/);
  await expect(
    page.getByText("No sources match these filters.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page).toHaveURL("/sources?catalog=vendor");
  await expect(page.locator(".source-row")).toHaveCount(24);
});
