import { test, expect } from "./test";

test("score badges sit beside severity and explain scores on hover, focus and tap", async ({
  page,
  isMobile,
}) => {
  await page.goto("/?view=events");
  const card = page.locator("#event-1");
  await expect(card.locator('[data-slot="badge"]')).toHaveText([
    "Critical",
    "CVSS 9.8",
    "EPSS 12.3%",
    "Fix available",
  ]);
  const cvss = card.getByRole("button", { name: "CVSS 9.8", exact: true });
  const epss = card.getByRole("button", { name: "EPSS 12.3%", exact: true });
  if (isMobile) await cvss.tap();
  else await cvss.hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "technical severity from 0 to 10",
  );
  await expect(page.getByRole("tooltip")).toContainText("CVSS v3.1");
  if (isMobile) {
    await cvss.tap();
    await expect(page.getByRole("tooltip")).toHaveCount(0);
    await cvss.tap();
    await expect(page.getByRole("tooltip")).toContainText("CVSS v3.1");
  } else {
    await epss.hover();
    await expect(page.getByRole("tooltip")).toContainText("next 30 days");
    await cvss.hover();
    await expect(page.getByRole("tooltip")).toContainText("CVSS v3.1");
  }
  await cvss.press("Escape");
  await expect(page.getByRole("tooltip")).toHaveCount(0);
  if (isMobile) await epss.tap();
  else await epss.focus();
  await expect(page.getByRole("tooltip")).toContainText("next 30 days");
  await expect(page.getByRole("tooltip")).toContainText(
    "Score date: 2026-10-26",
  );
  await epss.press("Escape");
  await expect(
    page.locator("#event-2").getByRole("button", { name: /CVSS|EPSS/ }),
  ).toHaveCount(0);
});

test("missing scores and provider failures remain unknown while cards stay usable", async ({
  page,
}) => {
  await page.route("**/api/v1/risk?*", (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto("/?view=events");
  await expect(
    page
      .locator("#event-1")
      .getByRole("button", { name: "EPSS —", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#event-1")
      .getByRole("button", { name: "CVSS 9.8", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#event-3")
      .getByRole("button", { name: "CVSS —", exact: true }),
  ).toBeVisible();
  await expect(
    page
      .locator("#event-3")
      .getByRole("button", { name: "EPSS —", exact: true }),
  ).toBeVisible();
  await page.locator("#event-1 h3 a").click();
  await expect(page).toHaveURL(/\/events\/1/);
});

test("a slow EPSS lookup does not delay the feed or CVSS badges", async ({
  page,
}) => {
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/risk?*", async (route) => {
    await pending;
    await route.fulfill({
      json: {
        availability: { epss: "available" },
        data: [
          {
            cve: "CVE-2026-12345",
            epss: {
              cve: "CVE-2026-12345",
              epss: 0,
              percentile: 0,
              date: "2026-10-26",
            },
          },
        ],
      },
    });
  });
  await page.goto("/?view=events");
  try {
    await expect(page.locator(".event-card")).toHaveCount(4);
    await expect(
      page
        .locator("#event-1")
        .getByRole("button", { name: "CVSS 9.8", exact: true }),
    ).toBeVisible();
    await expect(
      page
        .locator("#event-1")
        .getByRole("button", { name: "EPSS …", exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
  await expect(
    page
      .locator("#event-1")
      .getByRole("button", { name: "EPSS 0.00%", exact: true }),
  ).toBeVisible();
});

test("grouped cards display CVSS from the advisory's structured metrics", async ({
  page,
}) => {
  await page.goto("/?source=core-osv");
  await expect(
    page
      .locator("#event-4")
      .getByRole("button", { name: "CVSS 8.1", exact: true }),
  ).toBeVisible();
});
