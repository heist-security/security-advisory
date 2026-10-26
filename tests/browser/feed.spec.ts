import { test, expect } from "@playwright/test";
test("structured source filters show references rather than extracted quotations", async ({
  page,
  request,
}) => {
  await page.goto("/?source=core-osv");
  await expect(page.locator(".event-card")).toHaveCount(1);
  const event = page.locator("#event-4");
  await event.locator("h3 a").click();
  await expect(page).toHaveURL(/\/advisories\//);
  await expect(page.locator(".detail-disclaimer")).toContainText(
    "Imported from structured advisory data",
  );
  await expect(
    page.getByText("Source reference: /affected/0/versions", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Not stated in this record").first(),
  ).toBeVisible();
  await expect(page.locator("blockquote")).toHaveCount(0);
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
test("the feed opens source details and earlier correction revisions", async ({
  page,
}) => {
  await page.goto("/?view=events");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Security feed",
  );
  await expect(page.locator(".event-card")).toHaveCount(4);
  await page.locator("#event-1 h3 a").click();
  await expect(page).toHaveURL(/\/events\/1/);
  await expect(page.getByText("Fixed versions", { exact: true })).toBeVisible();
  await expect(
    page.locator("blockquote").filter({ hasText: "Fixed in 99.0.1." }).last(),
  ).toBeVisible();
  await page.getByRole("link", { name: "Back to feed", exact: false }).click();
  await expect(page).toHaveURL(/view=events/);
  await page.locator("#event-2 h3 a").click();
  await expect(
    page.getByText("Correction to Heist’s extraction", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "View the preceding event", exact: true })
    .click();
  await expect(page).toHaveURL(/\/events\/1$/);
});
test("technology multi-selection persists and matches any selected product", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: /^Technology/ }).click();
  await page.getByLabel("Search technologies", { exact: true }).fill("Node");
  await expect(
    page.getByRole("checkbox", { name: "Node.js", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("checkbox", { name: /Node.js \d|^nodejs$/ }),
  ).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Node.js", exact: true }).check();
  await expect(page).toHaveURL(/technology=node-js/);
  await expect(page.locator(".technology-filter")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByLabel("Search technologies", { exact: true }).fill("Ruby");
  await page.getByRole("checkbox", { name: "Ruby", exact: true }).check();
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await expect(page.locator(".event-card")).toHaveCount(2);
  const rss = page
    .getByRole("navigation", { name: "Feed formats" })
    .getByRole("link", { name: "RSS", exact: true });
  await expect(rss).toHaveAttribute(
    "href",
    "/feed.xml?view=grouped&technology=node-js%2Cruby",
  );
  const json = await (
    await request.get("/api/v1/events?technology=node-js,ruby")
  ).json();
  expect(json.data.map((e: { id: number }) => e.id)).toEqual([3, 2, 1]);
  const xml = await (
    await request.get("/feed.xml?view=grouped&technology=node-js,ruby")
  ).text();
  for (const id of [1, 2, 3]) expect(xml).toContain("heist-group-update:" + id);
  expect(xml).not.toContain("heist-group-update:4");
  await page.reload();
  await page.getByRole("button", { name: /^Technology/ }).click();
  await page
    .getByRole("button", { name: "Remove Node.js", exact: true })
    .click();
  await page.getByLabel("Search technologies", { exact: true }).press("Escape");
  await expect(page.locator(".event-card")).toHaveCount(1);
  await expect(page.locator("#event-3")).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
});
test("search and type remain combined with canonical technology and severity subscriptions", async ({
  page,
  request,
}) => {
  await page.goto("/");
  await page
    .getByRole("searchbox", { name: "Search feed", exact: true })
    .fill("fictional");
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("checkbox", { name: "Patch", exact: true }).check();
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("button", { name: /^Severity/ }).click();
  await page.getByRole("checkbox", { name: "Critical", exact: true }).check();
  await page.getByRole("button", { name: /^Severity/ }).click();
  await page.getByRole("button", { name: /^Technology/ }).click();
  await page.getByRole("checkbox", { name: "Node.js", exact: true }).check();
  await page
    .getByRole("searchbox", { name: "Search technologies", exact: true })
    .press("Escape");
  await expect(page.locator(".event-card")).toHaveCount(1);
  const suffix =
    "?view=grouped&q=fictional&type=patch&technology=node-js&severity=critical";
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml" + suffix);
  const json = await (await request.get("/api/v1/events" + suffix)).json();
  expect(json.data.map((e: { id: number }) => e.id)).toEqual([2]);
  await page.reload();
  await expect(
    page.getByRole("searchbox", { name: "Search feed", exact: true }),
  ).toHaveValue("fictional");
  await page.getByRole("button", { name: /^Type/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Patch", exact: true }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Patch", exact: true }).uncheck();
  await page.getByRole("checkbox", { name: "Withdrawal", exact: true }).check();
  await page.getByRole("button", { name: /^Type/ }).click();
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
  await page.getByRole("button", { name: /^Technology/ }).click();
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
  await expect(page).toHaveURL("/?view=grouped");
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(
    page.getByRole("button", { name: "Remove C++", exact: true }),
  ).toHaveCount(0);
  await search.fill("C#");
  await search.press("Enter");
  await search.press("Escape");
  await expect(page.getByRole("button", { name: /^Technology/ })).toBeFocused();
  await expect(page).toHaveURL(/technology=c-sharp/);
});
test("cursor navigation retains filters and does not offer an empty extra page", async ({
  page,
}) => {
  await page.goto("/?view=events&type=patch&limit=1");
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
  await page.goto("/?q=NoSuchTechnology");
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "No events match your filters." }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Reset filters", exact: true }).click();
  await expect(page.locator(".event-card")).toHaveCount(3);
  await page.goto("/?before=1");
  await expect(page.getByRole("status")).toContainText("No earlier events.");
  await page
    .getByRole("link", { name: "Back to latest events", exact: true })
    .click();
  await expect(page.locator(".event-card")).toHaveCount(3);
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
  await expect(page.locator(".event-card")).toHaveCount(3);
  await expect(page.getByRole("search")).toBeVisible();
  await expect(
    page
      .getByRole("navigation", { name: "Main navigation" })
      .getByRole("link", { name: "Feed", exact: true }),
  ).toHaveAttribute("href", "/");
  await expect(page.locator(".day-heading")).toHaveText([
    "25 October 2026",
    "24 October 2026",
  ]);
  await expect(page.locator("#event-4 time")).toHaveAttribute(
    "datetime",
    "2026-10-25T08:15:00Z",
  );
  await expect(page.locator("#event-4 time")).toHaveText(
    "25 Oct 2026, 08:15 UTC",
  );
  await page.goto("/feed?view=events&type=patch&limit=1&before=2");
  await expect(page).toHaveURL(/\/\?view=events&type=patch&limit=1&before=2$/);
  await expect(page.locator("#event-1")).toBeVisible();
  await expect(page.locator(".event-card")).toHaveCount(1);
});

test("severity filters share RSS/JSON and keep correction delivery", async ({
  page,
  request,
}) => {
  await page.goto("/?view=events");
  await page.getByRole("button", { name: /^Severity/ }).click();
  await page.getByRole("checkbox", { name: "Critical", exact: true }).check();
  await expect(page).toHaveURL(/severity=critical/);
  await expect(page.locator(".severity-filter")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.getByRole("checkbox", { name: "High", exact: true }).check();
  await page.getByRole("button", { name: /^Severity/ }).click();
  await expect(page.locator(".event-card")).toHaveCount(2);
  await expect(page.locator("#event-1")).toContainText("Linked Critical CVE");
  await page.locator("#event-1 h3 a").click();
  await expect(page.locator(".linked-ratings")).toContainText("GitLab");
  await page.getByRole("link", { name: "Back to feed", exact: false }).click();
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
  await page.getByRole("button", { name: /^Severity/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Critical", exact: true }),
  ).toBeChecked();
});

test("catalog results for a previously unseen product become stable subscriptions", async ({
  page,
}) => {
  await page.route("**/api/v1/technologies?*", (route) =>
    route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
        data: [{ value: "example-engine", label: "Example Engine" }],
      }),
    }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /^Technology/ }).click();
  await page
    .getByRole("searchbox", { name: "Search technologies", exact: true })
    .fill("Example Engine v7.2");
  await page
    .getByRole("checkbox", { name: "Example Engine", exact: true })
    .check();
  await page
    .getByRole("searchbox", { name: "Search technologies", exact: true })
    .press("Escape");
  await expect(page).toHaveURL(/technology=example-engine/);
  await expect(
    page
      .getByRole("navigation", { name: "Feed formats" })
      .getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml?view=grouped&technology=example-engine");
});

test("type multi-selection matches any selected type in the reader and subscriptions", async ({
  page,
  request,
}) => {
  await page.goto("/?before=5&limit=1");
  await page.getByRole("button", { name: /^Type/ }).click();
  await page.getByRole("checkbox", { name: "Patch", exact: true }).check();
  await page.getByRole("checkbox", { name: "Advisory", exact: true }).check();
  await page
    .getByRole("checkbox", { name: "Advisory", exact: true })
    .press("Escape");
  await expect(page).toHaveURL(
    (url) =>
      url.searchParams.get("type") === "advisory,patch" &&
      !url.searchParams.has("before"),
  );
  await expect(page.locator(".event-card")).toHaveCount(3);
  const formats = page.getByRole("navigation", { name: "Feed formats" });
  const suffix = "?view=grouped&type=advisory%2Cpatch";
  await expect(
    formats.getByRole("link", { name: "RSS", exact: true }),
  ).toHaveAttribute("href", "/feed.xml" + suffix);
  await expect(
    formats.getByRole("link", { name: "JSON", exact: true }),
  ).toHaveAttribute("href", "/api/v1/events" + suffix);
  const grouped = await (await request.get("/api/v1/events" + suffix)).json();
  expect(grouped.data.map((row: { id: number }) => row.id)).toEqual([4, 3, 2]);
  const raw = await (
    await request.get("/api/v1/events?type=advisory,patch&after=0&limit=2")
  ).json();
  expect(raw.data.map((row: { id: number }) => row.id)).toEqual([1, 2]);
  expect(raw.data[1].payload.kind).toBe("withdrawal");
  const rss = await (await request.get("/feed.xml" + suffix)).text();
  for (const id of [2, 3, 4]) expect(rss).toContain("heist-group-update:" + id);
  await page.reload();
  await page.getByRole("button", { name: /^Type/ }).click();
  await expect(
    page.getByRole("checkbox", { name: "Patch", exact: true }),
  ).toBeChecked();
  await expect(
    page.getByRole("checkbox", { name: "Advisory", exact: true }),
  ).toBeChecked();
  await page.getByRole("checkbox", { name: "Patch", exact: true }).uncheck();
  await expect(page).toHaveURL(/type=advisory/);
  await expect(page.locator(".event-card")).toHaveCount(2);
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(page).not.toHaveURL(/type=/);
  await expect(page.locator(".event-card")).toHaveCount(3);
});
