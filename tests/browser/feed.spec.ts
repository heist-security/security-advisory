import { test, expect } from "@playwright/test";
test("structured source filters show references rather than extracted quotations", async ({
  page,
  request,
}) => {
  await page.goto("/?source=core-osv");
  await expect(page.locator(".event-card")).toHaveCount(1);
  const event = page.locator("#event-4");
  await expect(event.locator(".event-foot")).toContainText(
    "Structured advisory",
  );
  await event.getByText("Evidence and details", { exact: false }).click();
  await expect(event.locator(".detail-disclaimer")).toContainText(
    "Imported from structured advisory data",
  );
  await expect(
    event.getByText("Source reference: /affected/0/versions", { exact: true }),
  ).toBeVisible();
  await expect(
    event.getByText("Not stated in this record").first(),
  ).toBeVisible();
  await expect(event.locator("blockquote")).toHaveCount(0);
  const data = await (
    await request.get("/api/v1/events?source=core-osv")
  ).json();
  expect(data.data[0].extraction_method).toBe("structured");
  expect(data.data[0].payload.structured.affected[0].versions).toEqual([
    "1.0.0",
  ]);
  expect(
    await (await request.get("/feed.xml?source=core-osv")).text(),
  ).toContain("Imported from structured advisory data");
});
test("visual reader displays the shared stream and expands source evidence", async ({
  page,
}, info) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Security feed",
  );
  await expect(page.locator(".event-card")).toHaveCount(4);
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS" }),
  ).toHaveAttribute("href", "/feed.xml");
  await page.screenshot({
    path: "test-results/" + info.project.name + "-visual-reader.png",
    fullPage: true,
  });
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
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
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.screenshot({
    path: "test-results/" + info.project.name + "-visual-reader.png",
    fullPage: true,
  });
});
test("technology multi-selection persists and matches any selected product", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.locator(".technology-filter summary").click();
  await page.getByLabel("Search technologies", { exact: true }).fill("Node");
  await expect(
    page.getByRole("checkbox", { name: "Node.js", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: /Node.js \d|^nodejs$/ }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Node.js", exact: true }).check();
  await page.getByLabel("Search technologies", { exact: true }).fill("Ruby");
  await page.getByRole("checkbox", { name: "Ruby", exact: true }).check();
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
  const rss = page
    .getByRole("navigation", { name: "Feed formats" })
    .getByRole("link", { name: "RSS", exact: true });
  await expect(rss).toHaveAttribute(
    "href",
    "/feed.xml?technology=node-js%2Cruby",
  );
  const json = await (
    await request.get("/api/v1/events?technology=node-js,ruby")
  ).json();
  expect(json.data.map((e: { id: number }) => e.id)).toEqual([3, 2, 1]);
  const xml = await (
    await request.get("/feed.xml?technology=node-js,ruby")
  ).text();
  for (const id of [1, 2, 3]) expect(xml).toContain("heist-event:" + id);
  expect(xml).not.toContain("heist-event:4");
  await page.reload();
  await page.locator(".technology-filter summary").click();
  await page
    .getByRole("button", { name: "Remove Node.js", exact: true })
    .click();
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-3")).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(4);
});
test("search and type remain combined with canonical technology and severity subscriptions", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search feed", exact: true })
    .fill("fictional");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("patch");
  await page.locator(".severity-filter summary").click();
  await page.getByRole("checkbox", { name: "Critical", exact: true }).check();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await page.locator(".severity-filter summary").click();
  await page.locator(".technology-filter summary").click();
  await page.getByRole("checkbox", { name: "Node.js", exact: true }).check();
  await page
    .getByRole("searchbox", { name: "Search technologies", exact: true })
    .press("Escape");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(2);
  const suffix = "?q=fictional&type=patch&technology=node-js&severity=critical";
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml" + suffix);
  const json = await (await request.get("/api/v1/events" + suffix)).json();
  expect(json.data.map((e: { id: number }) => e.id)).toEqual([2, 1]);
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search feed", exact: true }),
  ).toHaveValue("fictional");
  await expect(
    page.getByRole("combobox", { name: "Type", exact: true }),
  ).toHaveValue("patch");
  await page
    .getByRole("combobox", { name: "Type", exact: true })
    .selectOption("withdrawal");
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-2")).toBeVisible();
  const legacy = await (
    await request.get("/api/v1/events?technology=Node.js%208&type=patch")
  ).json();
  expect(legacy.data.map((e: { id: number }) => e.id)).toEqual([2, 1]);
});
test("technology picker supports custom entries, clearing and failed suggestions", async ({
  page,
}) => {
  await page.route("**/api/v1/technologies?*", (route) =>
    route.fulfill({ status: 503, body: "Unavailable" }),
  );
  await page.goto("/");
  await page.locator(".technology-filter summary").click();
  const search = page.getByLabel("Search technologies", { exact: true });
  await search.fill("C++");
  await expect(
    page.getByRole("status").filter({ hasText: "Suggestions unavailable" }),
  ).toBeVisible();
  await search.press("Enter");
  await expect(
    page.getByRole("button", { name: "Remove C++", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Remove C++", exact: true }),
  ).toHaveCount(0);
  await search.fill("C#");
  await search.press("Enter");
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
  await search.press("Escape");
  await expect(page.locator(".technology-filter summary")).toBeFocused();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page).toHaveURL(/technology=c-sharp/);
});
test("cursor navigation retains filters and does not offer an empty extra page", async ({
  page,
}) => {
  await page.goto("/?type=patch&limit=1");
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
}, info) => {
  await page.goto("/?q=NoSuchTechnology");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "No events match your filters." }),
  ).toBeVisible();
  await page.screenshot({
    path: "test-results/" + info.project.name + "-empty-feed.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(4);
  await page.goto("/?before=1");
  await expect(page.getByRole("status")).toContainText("No earlier events.");
  await page
    .getByRole("link", { name: "Back to latest events", exact: true })
    .click();
  await expect(page.locator(".event-card")).toHaveCount(4);
  await page.goto("/?type=invalid");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Invalid event type",
  );
  await page.goto("/?source=fixture-unavailable");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Feed temporarily unavailable." }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Try again", exact: false }),
  ).toBeVisible();
});
test("the homepage is the reader and old feed URLs preserve filters", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Security feed",
  );
  await expect(page.locator(".event-card")).toHaveCount(4);
  await expect(page.getByRole("search")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Feed", exact: true }),
  ).toHaveAttribute("href", "/");
  await page.goto("/feed?type=patch&limit=1&before=2");
  await expect(page).toHaveURL(/\/\?type=patch&limit=1&before=2$/);
  await expect(page.locator("#event-1")).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(1);
});

test("severity filters share RSS/JSON and keep correction delivery", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.locator(".severity-filter summary").click();
  await page.getByRole("checkbox", { name: "Critical", exact: true }).check();
  await page.getByRole("checkbox", { name: "High", exact: true }).check();
  await page.locator(".severity-filter summary").click();
  await page.getByRole("button", { name: "Filter", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(2);
  await expect(page.locator("#event-1")).toContainText("Linked Critical CVE");
  await page
    .locator("#event-1")
    .getByText("Evidence and details", { exact: false })
    .click();
  await expect(page.locator("#event-1 .linked-ratings")).toContainText(
    "GitLab",
  );
  const href = await page
    .getByRole("navigation", { name: "Feed formats" })
    .getByRole("link", { name: "RSS", exact: true })
    .getAttribute("href");
  expect(new URL(href!, page.url()).searchParams.get("severity")).toBe(
    "critical,high",
  );
  const json = await (
    await request.get(href!.replace("/feed.xml", "/api/v1/events"))
  ).json();
  expect(json.data.map((e: { id: number }) => e.id)).toEqual([2, 1]);
  const xml = await (await request.get(href!)).text();
  expect(xml).toContain("Linked Critical CVE");
  expect(xml).toContain("heist-event:2");
  await page.reload();
  await page.locator(".severity-filter summary").click();
  await expect(
    page.getByRole("checkbox", { name: "Critical", exact: true }),
  ).toBeChecked();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(page.viewportSize()!.width);
});
