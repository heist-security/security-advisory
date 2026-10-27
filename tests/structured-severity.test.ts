import { expect, it } from "vitest";
import { osvSeverity } from "../src/adapters/sources/structured/severity";
import upstreamOsv from "./fixtures/osv-upstream.json";

it("matches the reported CVSS 4.0 score for the Chainguard advisory", () => {
  expect(osvSeverity(upstreamOsv.severity)).toEqual({
    score: 6.9,
    severity: "medium",
    index: 0,
  });
});

it.each([
  ["3.0", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8, "critical"],
  ["3.1", "AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8, "critical"],
  ["3.1", "AV:N/AC:H/PR:N/UI:N/S:U/C:H/I:H/A:H", 8.1, "high"],
  ["3.1", "AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", 5.3, "medium"],
  ["3.1", "AV:L/AC:H/PR:H/UI:R/S:U/C:L/I:N/A:N", 1.8, "low"],
])("scores CVSS %s %s", (version, vector, score, severity) => {
  expect(
    osvSeverity([{ type: "CVSS_V3", score: `CVSS:${version}/${vector}` }]),
  ).toEqual({ score, severity, index: 0 });
});

it("selects the highest valid rating and retains its source pointer", () => {
  expect(
    osvSeverity([
      { type: "CVSS_V4", score: "invalid" },
      ...upstreamOsv.severity,
      {
        type: "CVSS_V3",
        score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      },
    ]),
  ).toEqual({ score: 9.8, severity: "critical", index: 2 });
});

it.each(
  [
    [],
    [{ type: "CVSS_V4", score: "CVSS:4.0/AV:N" }],
    [{ type: "CVSS_V3", score: "CVSS:3.1/AV:N" }],
    [{ type: "CVSS_V3", score: upstreamOsv.severity[0].score }],
    [{ type: "CVSS_V4", score: 6.9 }],
    [{ type: "OTHER", score: "critical" }],
    [{ type: "CVSS_V3", score: "9.8" }],
    [
      {
        type: "CVSS_V3",
        score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N",
      },
    ],
    [
      {
        type: "CVSS_V4",
        score:
          "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:N/VA:N/SC:N/SI:N/SA:N",
      },
    ],
  ].map((metrics) => ({ metrics })),
)(
  "leaves missing, malformed, unsupported or zero ratings unknown: %j",
  ({ metrics }) => {
    expect(osvSeverity(metrics)).toBeUndefined();
  },
);
