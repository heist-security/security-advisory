import { expect, it } from "vitest";
import { parseEventQuery, filterQuery } from "../src/lib/filters";
import { feedLink, groupEvents } from "../src/lib/feed-view";
import type { FeedEvent } from "../src/lib/events";
it("normalizes bounded search and shares it between browser and subscriptions", () => {
  const query = parseEventQuery(
    new URLSearchParams("q=++certificate+++validation++&type=patch"),
  );
  expect(query.q).toBe("certificate validation");
  expect(filterQuery(query).toString()).toBe(
    "q=certificate+validation&type=patch",
  );
  expect(feedLink(query, { before: "42", limit: "20" })).toBe(
    "/?q=certificate+validation&type=patch&before=42&limit=20",
  );
  for (const params of [
    new URLSearchParams("q=a&q=b"),
    new URLSearchParams({ q: "x".repeat(121) }),
    new URLSearchParams({ q: "bad\u0000value" }),
  ])
    expect(() => parseEventQuery(params)).toThrow();
});
it("groups by UTC publication day while preserving event order", () => {
  const rows = [
    { id: 3, published_at: "2026-10-24T00:30:00+02:00" },
    { id: 2, published_at: "2026-10-23T21:00:00Z" },
    { id: 1, published_at: "2026-10-22T21:00:00Z" },
  ] as FeedEvent[];
  const groups = groupEvents(rows);
  expect(
    groups.map((group) => ({
      day: group.day,
      ids: group.events.map((event) => event.id),
    })),
  ).toEqual([
    { day: "2026-10-23", ids: [3, 2] },
    { day: "2026-10-22", ids: [1] },
  ]);
});
