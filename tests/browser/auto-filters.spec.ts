import { test, expect } from "@playwright/test";

test("feed search applies after typing stops and clearing restores the feed", async ({
  page,
}) => {
  await page.goto("/");
  await page.clock.install({ time: new Date("2026-10-24T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-24T00:01:00Z"));
  const search = page.getByRole("searchbox", {
    name: "Search feed",
    exact: true,
  });
  await search.fill("Ru");
  await page.clock.runFor(200);
  await search.fill("Ruby ");
  await page.clock.runFor(299);
  await expect(page).toHaveURL("/");
  await expect(page.getByRole("status")).toHaveText("Loading advisories…");
  await expect(page.locator(".event-card")).toHaveCount(0);
  await page.clock.runFor(1);
  await expect(page).toHaveURL(/q=Ruby/);
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-3")).toBeVisible();
  await expect(page.getByText("Loading advisories…")).toHaveCount(0);
  await expect(search).toBeFocused();
  await expect(search).toHaveValue("Ruby ");
  await search.pressSequentially("advisory");
  await page.clock.runFor(300);
  await expect(page).toHaveURL(/q=Ruby\+advisory/);
  await expect(page.locator("#event-3")).toBeVisible();
  await search.fill("");
  await page.clock.runFor(300);
  await expect(page).toHaveURL("/?view=grouped");
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml?view=grouped");
});

test("filter changes show a skeleton until results arrive and keep controls usable", async ({
  page,
}) => {
  await page.goto("/");
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    (url) => url.pathname === "/" && url.searchParams.has("type"),
    async (route) => {
      await waiting;
      await route.continue();
    },
  );
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("checkbox", { name: "Advisory", exact: true }).check();
  try {
    await expect(page.getByRole("status")).toHaveText("Loading advisories…");
    await expect(
      page.getByRole("region", { name: "Security announcements" }),
    ).toHaveAttribute("aria-busy", "true");
    await expect(page.locator(".event-card")).toHaveCount(0);
    await expect(
      page.getByRole("searchbox", { name: "Search feed", exact: true }),
    ).toBeEnabled();
    await expect(
      page.getByRole("checkbox", { name: "Advisory", exact: true }),
    ).toBeChecked();
  } finally {
    release();
  }
  await expect(page).toHaveURL(/type=advisory/);
  await expect(page.locator(".event-card")).toHaveCount(2);
  await expect(page.getByText("Loading advisories…")).toHaveCount(0);
  await page.getByRole("button", { name: /^Type/ }).click();
  await page
    .getByRole("searchbox", { name: "Search feed", exact: true })
    .fill("no-such-advisory");
  await expect(page.getByRole("status")).toHaveText(
    "No events match your filters.",
  );
});

test("a selection includes pending search text and resets the feed cursor", async ({
  page,
}) => {
  const group = "advisory:00000000-0000-0000-0000-000000000001";
  await page.goto(
    `/?view=events&group=${encodeURIComponent(group)}&source=nodejs&limit=1&before=2`,
  );
  await expect(page.locator("#event-1")).toBeVisible();
  await page.clock.install({ time: new Date("2026-10-24T00:00:00Z") });
  await page.clock.pauseAt(new Date("2026-10-24T00:01:00Z"));
  await page
    .getByRole("searchbox", { name: "Search feed", exact: true })
    .fill("fictional");
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("checkbox", { name: "Withdrawal", exact: true }).check();
  await expect(page).toHaveURL(/type=withdrawal/);
  expect(new URL(page.url()).searchParams.get("source")).toBe("nodejs");
  expect(new URL(page.url()).searchParams.get("view")).toBe("events");
  expect(new URL(page.url()).searchParams.get("group")).toBe(group);
  expect(new URL(page.url()).searchParams.get("q")).toBe("fictional");
  expect(new URL(page.url()).searchParams.has("before")).toBe(false);
  await page.clock.runFor(300);
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-2")).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: "Withdrawal", exact: true }),
  ).toBeChecked();
});

test("technology suggestions do not apply until selected, and deselecting clears filters", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Technology/ }).click();
  await page.getByLabel("Search technologies", { exact: true }).fill("Ruby");
  const ruby = page.getByRole("checkbox", { name: "Ruby", exact: true });
  await expect(ruby).toBeVisible();
  await expect(page).toHaveURL("/");
  await ruby.check();
  await expect(page).toHaveURL(/technology=ruby/);
  await expect(page.locator("#event-3")).toBeVisible();
  await ruby.uncheck();
  await expect(page).toHaveURL("/?view=grouped");
  await expect(page.locator(".event-card")).toHaveCount(3);
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await expect(page.getByRole("button", { name: /^Technology/ })).toBeFocused();
  await page.getByRole("button", { name: /^Severity/ }).click();
  const critical = page.getByRole("checkbox", {
    name: "Critical",
    exact: true,
  });
  await critical.check();
  await expect(page).toHaveURL(/severity=critical/);
  await critical.uncheck();
  await expect(page).toHaveURL("/?view=grouped");
  await expect(page.locator(".event-card")).toHaveCount(3);
});

test("source filters apply automatically and keep the selected catalog", async ({
  page,
}) => {
  await page.goto("/sources?catalog=vendor&page=2");
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
    .getByRole("searchbox", { name: "Search", exact: true })
    .fill("NoSuchSource");
  await expect(page).toHaveURL(/q=NoSuchSource/);
  await expect(
    page.getByText("No sources match these filters.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page).toHaveURL("/sources?catalog=vendor");
  await expect(page.locator(".source-row")).toHaveCount(24);
});

test("filter popovers support keyboard selection, Escape and outside clicks", async ({
  page,
}) => {
  await page.goto("/");
  const severity = page.getByRole("button", { name: /^Severity/ });
  await severity.focus();
  await severity.press("Enter");
  const critical = page.getByRole("checkbox", {
    name: "Critical",
    exact: true,
  });
  await expect(critical).toBeFocused();
  await critical.press("Space");
  await expect(page).toHaveURL(/severity=critical/);
  await expect(critical).toBeChecked();
  await critical.press("Escape");
  await expect(severity).toBeFocused();
  await expect(severity).toHaveAttribute("aria-expanded", "false");

  const technology = page.getByRole("button", { name: /^Technology/ });
  await technology.press("Enter");
  await expect(
    page.getByRole("searchbox", { name: "Search technologies" }),
  ).toBeFocused();
  const search = page.getByRole("searchbox", {
    name: "Search feed",
    exact: true,
  });
  await search.click();
  await expect(technology).toHaveAttribute("aria-expanded", "false");
  await expect(search).toBeFocused();
});
