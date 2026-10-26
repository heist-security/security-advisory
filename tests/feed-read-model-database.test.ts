import { readFileSync, readdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { afterEach, beforeEach, expect, it } from "vitest";

let db: PGlite;
const migration = new URL(
  "../supabase/migrations/202610260020_feed_read_model.sql",
  import.meta.url,
);
beforeEach(async () => {
  db = new PGlite();
  await db.exec(
    "create role anon; create role authenticated; create role service_role bypassrls;",
  );
  const folder = new URL("../supabase/migrations/", import.meta.url);
  for (const file of readdirSync(folder)
    .filter((f) => f.endsWith(".sql") && !f.endsWith("020_feed_read_model.sql"))
    .sort()) {
    await db.exec(readFileSync(new URL(file, folder), "utf8"));
  }
  // Build the old schema's populated feed before the new tables exist.
  const fixture = readFileSync(
    new URL("./fixtures/group-query.sql", import.meta.url),
    "utf8",
  )
    .replace(/insert into advisory_(feed|update)_members[\s\S]*?;/g, "")
    .replace(/analyze advisory_(feed|update)_members;/g, "");
  await db.exec(
    "set test.group_query_rows='40'; set test.group_query_words='1';" + fixture,
  );
  await db.exec(readFileSync(migration, "utf8"));
}, 30000);
afterEach(async () => db.close());

async function read(
  name: string,
  filters = {},
  after: number | null = null,
  before: number | null = null,
  updates = false,
) {
  return (
    await db.query(
      `select item from ${name}($1,7,$2,$3${name.includes("groups") ? ",$4" : ""}) item`,
      [
        JSON.stringify(filters),
        after,
        before,
        ...(name.includes("groups") ? [updates] : []),
      ],
    )
  ).rows;
}
async function drain() {
  for (let i = 0; i < 100; i++) {
    const { rows } = await db.query<{ done: boolean }>(
      "select * from backfill_advisory_feed(3)",
    );
    if (rows[0].done) return;
  }
  throw new Error("Backfill did not finish");
}

it("keeps the old endpoint complete while copying and preserves every page after cutover", async () => {
  const history = (
    await db.query(
      "select id,revision,published_at,payload from events order by id",
    )
  ).rows;
  const before = await read("query_advisory_groups_legacy");
  await db.query("select * from backfill_advisory_feed(3)");
  expect(await read("query_advisory_groups")).toEqual(before);
  await drain();
  for (const updates of [false, true]) {
    for (const filters of [
      {},
      { type: "advisory,patch", severity: ["critical", "high"] },
      { type: "patch" },
      { q: "Brotli" },
      { q: "fixture" },
      { source: "core-cve' OR true --" },
      { important: "1" },
    ]) {
      for (const [after, before] of [
        [null, null],
        [0, null],
        [null, 20],
        [39, null],
      ]) {
        const legacy = await read(
          "query_advisory_groups_legacy",
          filters,
          after,
          before,
          updates,
        );
        expect(
          await read(
            updates ? "query_advisory_updates" : "query_advisory_current",
            filters,
            after,
            before,
          ),
        ).toEqual(legacy);
        expect(
          await read("query_advisory_groups", filters, after, before, updates),
        ).toEqual(legacy);
      }
    }
  }
  expect(
    (
      await db.query(
        "select id,revision,published_at,payload from events order by id",
      )
    ).rows,
  ).toEqual(history);
  expect(
    (await db.query("select processed,done from backfill_advisory_feed(3)"))
      .rows,
  ).toEqual([{ processed: 0, done: true }]);
});

it("resumes around live revisions, synchronizes metadata corrections, and rolls back with publication", async () => {
  await db.query("select * from backfill_advisory_feed(3)");
  await db.exec(`
    update events set severity_keys=array['medium'],event_types=array['mitigation'],important=false,fix_available=false where id=1;
    insert into advisory_group_updates(group_id,revision,member_ids,primary_event_id,changed_event_id,change,published_at)
      select group_id,2,member_ids,primary_event_id,primary_event_id,'updated',now() from advisory_group_updates where id=1;
    update advisory_groups set latest_update_id=41,revision=2 where latest_update_id=1;
  `);
  await drain();
  for (const updates of [false, true]) {
    expect(
      await read(
        updates ? "query_advisory_updates" : "query_advisory_current",
        { severity: ["medium"] },
      ),
    ).toEqual(
      await read(
        "query_advisory_groups_legacy",
        { severity: ["medium"] },
        null,
        null,
        updates,
      ),
    );
  }
  expect(
    (
      await db.query(
        "select feed_id from advisory_feed_members where event_id=1",
      )
    ).rows,
  ).toEqual([{ feed_id: 41 }]);
  expect(
    (
      await db.query(
        "select feed_id from advisory_update_members where event_id=1 order by feed_id",
      )
    ).rows,
  ).toEqual([{ feed_id: 1 }, { feed_id: 41 }]);
  await db.exec("update events set important=true where id=1");
  expect(
    (
      await db.query(
        "select count(*)::integer count from advisory_update_members where important",
      )
    ).rows,
  ).toEqual([{ count: 2 }]);
  const before = await read("query_advisory_current");
  await db.exec(
    "begin; update advisory_groups set active=false where latest_update_id=41; rollback;",
  );
  expect(await read("query_advisory_current")).toEqual(before);
});
