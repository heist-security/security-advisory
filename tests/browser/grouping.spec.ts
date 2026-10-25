import { test, expect } from "@playwright/test";

test("grouped advisories retain source history, return filters and subscription links", async ({
  page,
  request,
}) => {
  const feed = "/?q=grouped-example&limit=1&before=300";
  await page.goto(feed);
  await expect(page.locator(".event-card")).toHaveCount(1);
  const card = page.locator(".event-card");
  await expect(card.locator(".group-sources")).toContainText(
    "2 source records",
  );
  const formats = page.getByRole("navigation", { name: "Feed formats" });
  const jsonUrl = await formats
    .getByRole("link", { name: "JSON", exact: true })
    .getAttribute("href");
  const json = await (await request.get(jsonUrl!)).json();
  expect(json.schema_version).toBe("2");
  expect(json.data).toHaveLength(1);
  expect(json.data[0].group.members).toHaveLength(2);
  expect(json.data[0].detail_url).toBe("/advisories/osv%3AGHSA-7x63-xv5r-3p2x");
  const rssUrl = await formats
    .getByRole("link", { name: "RSS", exact: true })
    .getAttribute("href");
  const rss = await (await request.get(rssUrl!)).text();
  expect(rss.match(/<item>/g)).toHaveLength(1);
  expect(rss).toContain("heist-group-update:200");
  expect(rss).toContain("/advisories/osv%3AGHSA-7x63-xv5r-3p2x");
  await card.locator("h3 a").click();
  await expect(page).toHaveURL(/\/advisories\/osv%3AGHSA-7x63-xv5r-3p2x/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "OAuth2 Proxy authentication bypass",
  );
  await expect(page.locator(".source-record")).toHaveCount(2);
  await expect(
    page.locator(".source-record").last().getByText("7.15.2", { exact: true }),
  ).toBeVisible();
  await expect(page.locator("#history li")).toHaveCount(2);
  await page.locator("#history li a").first().click();
  await expect(page).toHaveURL(/\/events\/202/);
  await expect(page.locator(".source-record")).toHaveCount(1);
  await page
    .getByRole("link", { name: "View current advisory", exact: true })
    .click();
  await expect(page.locator(".source-record")).toHaveCount(2);
  await page.getByRole("link", { name: "Back to feed", exact: false }).click();
  await expect(page).toHaveURL(
    (url) =>
      url.pathname === "/" &&
      url.searchParams.get("q") === "grouped-example" &&
      url.searchParams.get("before") === "300" &&
      url.searchParams.get("limit") === "1",
  );
});

test("detail URLs handle missing records, outages, group replacements and unsafe return links", async ({
  page,
  request,
}) => {
  for (const path of [
    "/events/not-a-number",
    "/events/999997",
    "/advisories/not-a-group",
    "/advisories/osv%3AGHSA-3333-3333-3333",
  ])
    expect((await request.get(path)).status()).toBe(404);
  await page.goto("/events/999998");
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "couldn’t load",
  );
  await expect(
    page.getByRole("link", { name: "Try again", exact: true }),
  ).toBeVisible();
  await page.goto("/events/1?from=https%3A%2F%2Fevil.example");
  await expect(
    page.getByRole("link", { name: "Back to feed", exact: false }),
  ).toHaveAttribute("href", "/");
  await page.goto(
    "/advisories/osv%3AGHSA-2222-2222-2222?from=%2F%3Fq%3Dgrouped-example",
  );
  await expect(page).toHaveURL(/\/advisories\/osv%3AGHSA-7x63-xv5r-3p2x/);
  await expect(
    page.getByRole("link", { name: "Back to feed", exact: false }),
  ).toHaveAttribute("href", "/?q=grouped-example");
});
