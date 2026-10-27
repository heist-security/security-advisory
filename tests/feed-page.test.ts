import { expect, it, vi } from "vitest";
import { isValidElement } from "react";
import { itemFixture } from "./support/fixtures";

vi.mock("../src/server/services", () => ({
  configured: () => true,
  sourceName: (id: string) => id,
  services: () => ({
    feed: {
      list: async () => [itemFixture()],
      technologies: () => new Promise(() => {}),
    },
  }),
}));

it("renders the feed even when technology discovery never finishes", async () => {
  const { default: Feed } = await import("../src/app/page");
  const page = await Feed({
    searchParams: Promise.resolve({ technology: "containerd" }),
  });
  expect(isValidElement(page)).toBe(true);
});
