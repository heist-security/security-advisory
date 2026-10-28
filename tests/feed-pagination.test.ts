import { afterAll, beforeAll, expect, it } from "vitest";
import { feedRepository } from "../src/adapters/postgres/feed-repository";
import {
  publicItem,
  type FeedQuery,
  type StoredItem,
} from "../src/domain/feed-item";
import { reconcile } from "../src/domain/reconcile";
import { applyMigrations, testDatabase } from "./support/database";
import { at, payload, record } from "./support/fixtures";

let test: Awaited<ReturnType<typeof testDatabase>>;
let feed: ReturnType<typeof feedRepository>;
let expected: ReturnType<typeof publicItem>[];
let allItems: ReturnType<typeof publicItem>[];

beforeAll(async () => {
  test = await testDatabase();
  await applyMigrations(test.db);
  await test.db.query("select finish_feed_migration()");
  feed = feedRepository(test.db);
  // Older matches followed by unrelated recent items. The search term exists
  // only in source evidence, so a lighter read must still search that evidence.
  const items = Array.from({ length: 60 }, (_, i) => {
    const data = {
      ...payload("1.0." + i, ["CVE-2026-" + (70000 + i)]),
      kind:
        i < 6
          ? i % 2
            ? ("mitigation" as const)
            : ("patch" as const)
          : ("advisory" as const),
      severity: i % 2 ? ("critical" as const) : ("high" as const),
      evidence: i < 6 ? "cursorregression evidence" : "unrelated evidence",
    };
    return reconcile([], [record("page-" + i, { payload: data })], at)[0];
  });
  const columns = Object.keys(items[0]).filter((column) => column !== "cursor");
  await test.db.query(
    `insert into feed_items(${columns.join(",")}) select ${columns.join(",")} from jsonb_populate_recordset(null::feed_items,$1::jsonb)`,
    [JSON.stringify(items)],
  );
  const { rows } = await test.db.query<{ item: StoredItem }>(
    "select to_jsonb(f)-'search_document' item from feed_items f order by cursor desc",
  );
  allItems = rows.map(({ item }) => publicItem(item));
  expected = allItems.filter((item) => item.kind !== "advisory");
}, 60000);

afterAll(async () => test?.close());

it("paginates combined filters in both directions and preserves the full public evidence contract", async () => {
  const filters: FeedQuery = {
    type: ["patch", "mitigation"],
    severity: ["high", "critical"],
    q: "cursorregression",
    technology: "containerd",
    source: "github-containerd-containerd",
    fix: "1",
    important: "1",
    limit: 2,
  };
  const descending = [];
  let before: number | undefined;
  for (let page = 0; page < 4; page++) {
    const items = await feed.list({ ...filters, before });
    expect(items).toHaveLength(page < 3 ? 2 : 0);
    descending.push(...items);
    before = items.at(-1)?.cursor;
  }
  expect(descending).toEqual(expected);
  const ascending = [];
  let after = 0;
  for (let page = 0; page < 4; page++) {
    const items = await feed.list({ ...filters, after });
    expect(items).toHaveLength(page < 3 ? 2 : 0);
    ascending.push(...items);
    after = items.at(-1)?.cursor ?? after;
  }
  expect(ascending).toEqual([...expected].reverse());
  expect(await feed.find(expected[0].id)).toEqual(expected[0]);
  expect(
    await feed.list({ ...filters, before: expected[0].cursor + 8 }),
  ).toEqual(expected.slice(0, 2));
  expect(await feed.list({ ...filters, q: "absentword" })).toEqual([]);
  expect(
    await feed.list({ ...filters, before: expected.at(-1)!.cursor }),
  ).toEqual([]);
});

it("returns complete pages for broad searches and respects both cursor bounds", async () => {
  expect(await feed.list({ q: "containerd", limit: 2 })).toEqual(
    allItems.slice(0, 2),
  );
  expect(
    await feed.list({ q: "containerd", before: allItems[1].cursor, limit: 2 }),
  ).toEqual(allItems.slice(2, 4));
  expect(
    await feed.list({
      q: "containerd",
      after: expected[3].cursor,
      before: expected[0].cursor,
      limit: 10,
    }),
  ).toEqual(expected.slice(1, 3).reverse());
});

it("keeps single type and severity filters ordered and bounded", async () => {
  const patches = expected.filter((item) => item.kind === "patch");
  expect(await feed.list({ type: ["patch"], limit: 2 })).toEqual(
    patches.slice(0, 2),
  );
  expect(
    await feed.list({ type: ["patch"], before: patches[1].cursor, limit: 2 }),
  ).toEqual(patches.slice(2));
  expect(
    await feed.list({
      severity: ["high"],
      before: expected[0].cursor,
      limit: 3,
    }),
  ).toEqual(patches);
  expect(
    await feed.list({ type: ["patch"], severity: ["critical"], limit: 20 }),
  ).toEqual([]);
});
