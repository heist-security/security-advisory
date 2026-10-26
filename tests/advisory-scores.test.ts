import { expect, it } from "vitest";
import { cvssScores } from "../src/lib/cvss";
import { advisoryCvss, scoreCves } from "../src/lib/advisory-scores";
import { normalizeRecord } from "../src/lib/structured/normalize";
import type { FeedEvent } from "../src/lib/events";
import upstreamOsv from "./fixtures/osv-upstream.json";

const event = {
  source_id: "core-osv",
  cve_ids: ["CVE-2020-99999"], // A historical subscription key, not current context.
  payload: normalizeRecord("core-osv", upstreamOsv).payload,
} as FeedEvent;

it("reads native CVE base scores across versions, including zero", () => {
  expect(
    cvssScores([
      { cvssV2_0: { baseScore: 0 } },
      { cvssV3_0: { baseScore: 7.5 } },
      { cvssV3_1: { baseScore: 9.8 } },
      { cvssV4_0: { baseScore: 9.3 } },
    ]),
  ).toEqual([
    { score: 0, version: "2.0" },
    { score: 7.5, version: "3.0" },
    { score: 9.8, version: "3.1" },
    { score: 9.3, version: "4.0" },
  ]);
});

it("calculates OSV vectors with the existing CVSS library and retains zero", () => {
  expect(
    cvssScores([
      { type: "CVSS_V2", score: "AV:N/AC:L/Au:N/C:P/I:P/A:P" },
      {
        type: "CVSS_V3",
        score: "CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H",
      },
      {
        type: "CVSS_V3",
        score: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N",
      },
      ...upstreamOsv.severity,
    ]),
  ).toEqual([
    { score: 7.5, version: "2.0" },
    { score: 9.8, version: "3.0" },
    { score: 0, version: "3.1" },
    { score: 6.9, version: "4.0" },
  ]);
});

it("ignores invalid scores and never converts labels to numbers", () => {
  expect(
    cvssScores([
      null,
      [],
      "critical",
      { cvssV3_1: { baseScore: "9.8" } },
      { cvssV3_1: { baseScore: 11 } },
      { cvssV3_1: { baseScore: -1 } },
      { cvssV3_1: { baseScore: NaN } },
      { cvssV3_1: { baseSeverity: "HIGH" } },
      { type: "CVSS_V3", score: "9.8" },
      { type: "CVSS_V4", score: "CVSS:4.0/AV:N" },
      { other: { baseScore: 10 } },
    ]),
  ).toEqual([]);
});

it("uses current CVE associations and keeps score provenance", () => {
  expect(scoreCves(event)).toEqual(["CVE-2026-101902"]);
  expect(advisoryCvss(event)).toEqual({
    score: 6.9,
    version: "4.0",
    source: upstreamOsv.id,
  });
});

it("selects the highest score across active group members and linked CVEs", () => {
  const linked = {
    ...event,
    priority: {
      linked_cves: [
        { cve: "CVE-2026-12345", metrics: [{ cvssV3_1: { baseScore: 9.8 } }] },
      ],
    },
    payload: {
      ...event.payload,
      related_cves: [{ value: "CVE-2026-12345", evidence: "/aliases" }],
    },
  } as FeedEvent;
  const withdrawn = {
    ...event,
    payload: {
      ...event.payload,
      kind: "withdrawal",
      related_cves: [{ value: "CVE-2020-99999", evidence: "/aliases" }],
      structured: {
        ...event.payload.structured!,
        metrics: [{ cvssV4_0: { baseScore: 10 } }],
      },
    },
  } as FeedEvent;
  const group = {
    ...event,
    group: { members: [event, linked, withdrawn] },
  } as FeedEvent;
  expect(advisoryCvss(group)).toEqual({
    score: 9.8,
    version: "3.1",
    source: "CVE-2026-12345",
  });
  expect(scoreCves(group)).toEqual(["CVE-2026-101902", "CVE-2026-12345"]);
  expect(advisoryCvss(withdrawn)).toBeNull();
  expect(scoreCves(withdrawn)).toEqual([]);
});
