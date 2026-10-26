import { test as base, expect } from "@playwright/test";

// Keep browser runs independent of live enrichment providers.
export const test = base.extend<{ epssApi: void }>({
  epssApi: [
    async ({ page }, use) => {
      await page.route("**/api/v1/risk?*", (route) => {
        const ids = new URL(route.request().url()).searchParams
          .get("cve")!
          .split(",");
        return route.fulfill({
          json: {
            availability: {
              epss: "available",
              kev: "available",
              nvd: "not_requested",
            },
            data: ids.map((cve) => ({
              cve,
              kev: null,
              epss: { cve, epss: 0.123, percentile: 0.9, date: "2026-10-26" },
            })),
          },
        });
      });
      await use();
    },
    { auto: true },
  ],
});
export { expect };
