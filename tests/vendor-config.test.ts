import { afterEach, expect, it, vi } from "vitest";
import sources from "../sources/registry.json";
import { selectedVendorIds } from "../src/adapters/sources/selection";
afterEach(() => vi.unstubAllEnvs());
it("keeps empty selection disabled and expands all to exactly the reviewed publishers", () => {
  expect(selectedVendorIds("")).toEqual([]);
  expect(selectedVendorIds("  ")).toEqual([]);
  expect(selectedVendorIds("all")).toEqual(sources.map((s) => s.id));
  expect(selectedVendorIds("all")).toHaveLength(374);
  expect(selectedVendorIds("ruby,nodejs,ruby")).toEqual(["ruby", "nodejs"]);
  expect(() => selectedVendorIds("all,ruby")).toThrow(/Unknown/);
  expect(() => selectedVendorIds("not-in-the-registry")).toThrow(/Unknown/);
});
it("uses the same production selection in the public source catalog", async () => {
  vi.stubEnv("VENDOR_SOURCE_IDS", "all");
  vi.resetModules();
  const { registry, sourcePage } =
    await import("../src/adapters/sources/registry");
  expect(registry).toHaveLength(377);
  expect(
    sourcePage(new URLSearchParams("q=Ruby")).rows.some((s) => s.id === "ruby"),
  ).toBe(true);
});
