import { describe, expect, it } from "vitest";
import { normalizeRecord } from "../src/adapters/sources/structured/normalize";
import { reconcile } from "../src/domain/reconcile";
import { itemDescription } from "../src/presentation/item-description";
import { rss } from "../src/presentation/rss";
import { at, itemFixture, record } from "./support/fixtures";

const id = "CGA-vq4g-fqv4-g2g6";
function advisory() {
  const normalized = normalizeRecord("core-osv", {
    id,
    modified: at,
    upstream: ["CVE-2026-102276"],
    affected: [
      {
        package: { name: "kibana-8.19-bitnami", ecosystem: "Chainguard" },
        ranges: [
          {
            type: "ECOSYSTEM",
            events: [{ introduced: "0" }, { fixed: "8.19.22-r5" }],
          },
        ],
      },
    ],
  });
  return reconcile(
    [],
    [
      record("fixture", {
        source_id: "core-osv",
        method: "structured",
        url: normalized.url,
        payload: normalized.payload,
      }),
    ],
    at,
  )[0];
}

describe("readable advisory descriptions", () => {
  it("uses package facts for an OSV record without prose and retains its ID and evidence", () => {
    const item = advisory();
    const before = structuredClone(item);
    const display = itemDescription(item);
    expect(display.title).toBe("kibana-8.19-bitnami — security advisory");
    expect(display.summary).toContain("CVE-2026-102276");
    expect(display.summary).toContain("Fixed in: 8.19.22-r5.");
    expect(display.identifiers).toEqual([{ id, label: "Chainguard advisory" }]);
    const xml = rss([item], "https://feed.example");
    expect(xml).toContain(`<title>${display.title}</title>`);
    expect(xml).toContain(`Chainguard advisory: ${id}`);
    expect(item).toEqual(before);
  });

  it("preserves descriptive source copy and removes a repeated description", () => {
    const title = "Kibana denial of service";
    const summary = "A crafted request can exhaust resources.";
    expect(itemDescription(itemFixture({ title, summary }))).toMatchObject({
      title,
      summary,
    });
    expect(
      itemDescription(itemFixture({ title, summary: title })).summary,
    ).toBe("");
    expect(itemDescription(itemFixture({ title: id, summary })).summary).toBe(
      summary,
    );
  });

  it("recognizes other structured IDs and handles missing package names", () => {
    const item = advisory();
    item.title = item.summary = "PYSEC-2026-123";
    item.records[0].payload.structured!.id = item.title;
    item.product_names = [];
    item.fixed_versions = [];
    item.fix_available = false;
    expect(itemDescription(item)).toMatchObject({
      title: "Security advisory",
      identifiers: [{ id: "PYSEC-2026-123", label: "Advisory ID" }],
    });
  });

  it("does not imply every product is fixed by a shared version", () => {
    const item = advisory();
    item.product_names.push("another-package");
    const display = itemDescription(item);
    expect(display.summary).not.toContain("Fixed in:");
    expect(display.summary).toContain("package details");
  });

  it("does not invent fix status or repeat stale remediation for withdrawals and regrouped items", () => {
    const item = advisory();
    expect(itemDescription({ ...item, kind: "withdrawal" })).toMatchObject({
      title: "kibana-8.19-bitnami — withdrawn security advisory",
      summary: "The source has withdrawn this advisory.",
    });
    expect(itemDescription({ ...item, active: false }).summary).not.toContain(
      "Fixed in:",
    );
    expect(
      itemDescription({ ...item, fix_available: false, fixed_versions: [] })
        .summary,
    ).not.toMatch(/fixed|unfixed|no fix/i);
  });
});
