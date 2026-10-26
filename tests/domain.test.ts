import { describe, expect, it } from "vitest";
import { reconcile } from "../src/domain/reconcile";
import { patchKey } from "../src/domain/identity";
import { validateEvidence } from "../src/domain/evidence";
import type { SourceRecord, StoredItem } from "../src/domain/feed-item";
import { at, payload, record, fact } from "./support/fixtures";
const later = "2026-10-27T10:00:00.000Z";
function state(previous: StoredItem[], incoming: SourceRecord[]) {
  const changes = reconcile(previous, incoming, later);
  return [...new Map([...previous, ...changes].map((i) => [i.id, i])).values()];
}
describe("patch identity", () => {
  it("combines every fixed version for the same products and exact fixed vulnerabilities, independent of day", () => {
    const a = record(),
      b = record("2.0.14", { published_at: later });
    const [item] = reconcile([], [a, b], at);
    expect(item.fixed_versions).toEqual(["2.0.14", "2.4.1"]);
    expect(item.fixed_cve_ids).toEqual(["CVE-2026-53493"]);
    expect(item.records).toHaveLength(2);
    expect(item.title).toBe("containerd security updates");
    expect(reconcile([], [b, a], at)).toEqual([item]);
  });
  it("keeps differing vulnerabilities, publishers, products, and unproven CVE mentions separate", () => {
    const first = record();
    const cases = [
      record("2.0.14", { payload: payload("2.0.14", ["CVE-2026-99999"]) }),
      record("2.0.14", {
        payload: payload("2.0.14", ["CVE-2026-53493", "CVE-2026-99999"]),
      }),
      record("2.0.14", { source_id: "another-publisher" }),
      record("2.0.14", { payload: { ...payload(), fixed_cves: [] } }),
      record("2.0.14", {
        payload: {
          ...payload(),
          products: [
            { ...payload().products[0], name: fact("different product") },
          ],
          fixed_cves: [
            { ...payload().fixed_cves![0], product: "different product" },
          ],
        },
      }),
    ];
    for (const other of cases)
      expect(reconcile([], [first, other], at)).toHaveLength(2);
    expect(
      patchKey(
        record("2.0.14", { payload: { ...payload(), fixed_cves: undefined } }),
      ),
    ).toBeNull();
  });
  it("requires quoted positive remediation evidence", () => {
    for (const evidence of [
      "containerd mentions CVE-2026-53493",
      "containerd will fix CVE-2026-53493",
      "containerd does not fix CVE-2026-53493",
    ]) {
      const p = payload();
      p.fixed_cves![0].evidence = evidence;
      const text = [
        p.evidence,
        evidence,
        p.products[0].name.value,
        ...p.products[0].fixed_versions.map((v) => v.value),
        ...p.products[0].affected_versions.map((v) => v.value),
      ].join(" ");
      expect(() => validateEvidence(p, text)).toThrow();
    }
  });
});
describe("source revisions and corrections", () => {
  it("is idempotent and ignores out-of-order documents", () => {
    const r = record(),
      first = reconcile([], [r], at);
    expect(reconcile(first, [{ ...r, document_id: 2 }], later)).toEqual([]);
    expect(
      reconcile(
        first,
        [{ ...r, document_id: 0, payload: payload("9.0.0") }],
        later,
      ),
    ).toEqual([]);
    const changed = reconcile(
      first,
      [
        {
          ...r,
          document_id: 3,
          payload: { ...r.payload, summary: "Corrected details" },
        },
      ],
      later,
    );
    expect(changed[0]).toMatchObject({
      id: first[0].id,
      revision: 2,
      created_at: at,
      updated_at: later,
    });
  });
  it("splits and rejoins corrections, with replacement pointers and stable identities", () => {
    const a = record(),
      b = record("2.0.14");
    const first = reconcile([], [a, b], at);
    const changed = {
      ...b,
      document_id: 2,
      payload: payload("2.0.14", ["CVE-2026-99999"]),
    };
    const split = state(first, [changed]);
    expect(split.filter((i) => i.active)).toHaveLength(2);
    expect(split.find((i) => i.id === first[0].id)!.fixed_versions).toEqual([
      "2.4.1",
    ]);
    const rejoined = state(split, [{ ...b, document_id: 3 }]);
    expect(rejoined.filter((i) => i.active)).toHaveLength(1);
    expect(rejoined.find((i) => !i.active)!.replaced_by).toEqual([first[0].id]);
    expect(rejoined.find((i) => i.active)!.fixed_versions).toEqual([
      "2.0.14",
      "2.4.1",
    ]);
  });
  it("withdraws a reclassified source without removing a still-valid patch", () => {
    const a = record(),
      b = record("2.0.14"),
      first = reconcile([], [a, b], at);
    const [changed] = reconcile(
      first,
      [
        {
          ...b,
          document_id: 2,
          payload: { ...b.payload, security_relevant: false },
        },
      ],
      later,
    );
    expect(changed.fixed_versions).toEqual(["2.4.1"]);
    expect(changed.kind).toBe("patch");
    expect(
      changed.records.find((r) => r.id === b.id)?.payload.correction_reason,
    ).toBe("reclassified_non_security");
    const [withdrawn] = reconcile(
      [changed],
      [
        {
          ...a,
          document_id: 3,
          payload: { ...a.payload, security_relevant: false },
        },
      ],
      later,
    );
    expect(withdrawn).toMatchObject({
      id: first[0].id,
      kind: "withdrawal",
      fixed_versions: [],
      cve_ids: [],
      fix_available: false,
    });
    expect(withdrawn.cve_keys).toEqual(first[0].cve_ids);
    expect(withdrawn.type_keys).toContain("patch");
    const [restored] = reconcile(
      [withdrawn],
      [{ ...a, document_id: 4 }],
      later,
    );
    expect(restored).toMatchObject({
      id: first[0].id,
      revision: 4,
      kind: "patch",
    });
  });
  it("does not publish an unrelated non-security document or borrow risk from a shared CVE", () => {
    expect(
      reconcile(
        [],
        [record("1", { payload: { ...payload(), security_relevant: false } })],
        at,
      ),
    ).toEqual([]);
    const advisory = record("advisory", {
      source_id: "core-cve",
      payload: { ...payload(), kind: "advisory", severity: "critical" },
    });
    const items = reconcile([], [record(), advisory], at);
    expect(items.find((i) => i.kind === "patch")!.severity).toBe("unknown");
  });
});
describe("conservative OSV mirrors", () => {
  const ghsa = "GHSA-2345-cfgh-jmpq";
  function osv(id: string, reviewed = false): SourceRecord {
    return record(id, {
      source_id: "core-osv",
      payload: {
        ...payload(),
        kind: "advisory",
        structured: {
          provider: "osv",
          id,
          modified: at,
          aliases: [ghsa, "CVE-2026-53493"],
          references: ["https://github.com/advisories/" + ghsa],
          provider_metadata: { github_reviewed: reviewed },
          affected: [
            {
              package: { ecosystem: "npm", name: "widget" },
              ranges: [
                {
                  type: "SEMVER",
                  events: [{ introduced: "0" }, { fixed: "1.2.3" }],
                },
              ],
            },
          ],
        },
      },
    });
  }
  it("requires an explicit reviewed anchor and matching bounded native package scope", () => {
    const primary = osv(ghsa, true),
      mirror = osv("MIRROR-123");
    expect(reconcile([], [mirror], at)).toHaveLength(1);
    const original = reconcile([], [mirror], at);
    const combined = state(original, [primary]);
    expect(combined.filter((i) => i.active)).toHaveLength(1);
    expect(combined.find((i) => !i.active)!.replaced_by).toEqual([
      combined.find((i) => i.active)!.id,
    ]);
    const conflict = structuredClone(mirror);
    conflict.payload.structured!.affected = [
      { package: { ecosystem: "npm", name: "widget" }, versions: ["9.0"] },
    ];
    expect(reconcile([], [primary, conflict], at)).toHaveLength(2);
    const unlinked = structuredClone(mirror);
    unlinked.payload.structured!.references = [];
    expect(reconcile([], [primary, unlinked], at)).toHaveLength(2);
  });
});
