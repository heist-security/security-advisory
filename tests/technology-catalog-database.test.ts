import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import { technologyFamily, technologyProductName } from "../src/lib/technology";
it("catalogs arbitrary historical and future products, retaining correction routing and package identities", async () => {
  const db = new PGlite();
  const sql = (name: string) =>
    readFileSync(
      new URL("../supabase/migrations/" + name, import.meta.url),
      "utf8",
    );
  try {
    await db.exec(
      "create role anon;create role authenticated;create role service_role;create table events(id bigint primary key,advisory_id text,source_id text,payload jsonb,technologies text[] default '{}');",
    );
    const unified = sql("202610240004_unified_feed.sql");
    await db.exec(
      unified.slice(
        unified.indexOf("create function public.technology_key"),
        unified.indexOf("alter table public.events add column technologies"),
      ),
    );
    const add = async (
      id: number,
      name: string,
      advisory = String(id),
      provider = "",
      ecosystem = "",
    ) =>
      db.query(
        "insert into events(id,advisory_id,source_id,payload) values($1,$2,'publisher',$3::jsonb)",
        [
          id,
          advisory,
          JSON.stringify({
            products: name
              ? [
                  {
                    name: { value: name, evidence: "/affected/0/package/name" },
                  },
                ]
              : [],
            structured: {
              provider,
              affected: [
                { package: { name, ecosystem: ecosystem || "package" } },
              ],
            },
          }),
        ],
      );
    await add(1, "Example Engine 1.2");
    await add(2, "Example Engine v3.4");
    await add(3, "", "1");
    await db.exec(sql("202610250010_technology_families.sql"));
    await db.exec(sql("202610250011_technology_catalog.sql"));
    expect((await db.query("select * from technology_catalog")).rows).toEqual(
      [],
    );
    const batch = () =>
      db.query<{ processed: number; done: boolean }>(
        "select * from backfill_event_technologies(2)",
      );
    expect((await batch()).rows[0]).toMatchObject({
      processed: 2,
      done: false,
    });
    expect((await batch()).rows[0]).toMatchObject({ processed: 1, done: true });
    expect((await batch()).rows[0]).toMatchObject({ processed: 0, done: true });
    expect(
      (await db.query("select id,label from technology_catalog")).rows,
    ).toEqual([{ id: "example-engine", label: "Example Engine" }]);
    expect(
      (
        await db.query(
          "select id from events where technology_ids && array['example-engine'] order by id limit 2",
        )
      ).rows,
    ).toEqual([{ id: 1 }, { id: 2 }]);
    expect(
      (await db.query("select technology_ids from events where id=3")).rows[0],
    ).toEqual({ technology_ids: ["example-engine"] });
    await add(4, "Never Seen Before 5.0");
    await add(5, "widget-2", "5", "osv");
    await add(6, "@scope/widget2", "6", "osv");
    await add(7, "C++");
    await add(8, "C#");
    await add(9, "node-gyp");
    await add(10, "Node.js 22");
    await add(11, "same-name", "11", "osv", "npm");
    await add(12, "same-name", "12", "osv", "PyPI");
    await add(13, "scope-widget2", "13", "osv");
    const ids = (
      await db.query<{ id: string }>("select id from technology_catalog")
    ).rows.map((r) => r.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        "never-seen-before",

        "c-plus-plus",
        "c-sharp",
        "node-gyp",
        "node-js",
      ]),
    );
    expect(ids.filter((id) => id.startsWith("pkg-"))).toHaveLength(5);
    expect(
      (
        await db.query(
          "select label from technology_catalog where id like 'pkg-%' and label not like 'same-name%' and label not like 'scope-widget2%' order by label",
        )
      ).rows,
    ).toEqual([
      { label: "@scope/widget2 (package)" },
      { label: "widget-2 (package)" },
    ]);
    expect(ids).not.toContain("publisher");
    const names = [
      "Elixir 1.18",
      "Django v5.2",
      "Apache HTTP Server 2.4.63",
      "Redis 7.2 (LTS)",
      "HTTP/2",
      "log4j2",
      "OAuth2",
      "7-Zip",
      "C++",
    ];
    for (const name of names) {
      const r = await db.query<{ name: string; key: string }>(
        "select technology_product_name($1) name,canonical_technology(technology_product_name($1)) key",
        [name],
      );
      expect(r.rows[0]).toEqual({
        name: technologyProductName(name),
        key: technologyFamily(name),
      });
    }
    expect(
      (
        await db.query(
          "select id from technology_catalog where search_document @@ to_tsquery('simple','example:*')",
        )
      ).rows,
    ).toEqual([{ id: "example-engine" }]);
    expect(
      (await db.query("select count(*)::int count from events")).rows[0],
    ).toEqual({ count: 13 });
    await db.exec("set enable_seqscan=off");
    expect(
      JSON.stringify(
        (
          await db.query(
            "explain (format json) select id from events where technology_ids && array['example-engine']",
          )
        ).rows,
      ),
    ).toContain("events_technology_ids");
    expect(
      JSON.stringify(
        (
          await db.query(
            "explain (format json) select id from technology_catalog where search_document @@ to_tsquery('simple','example:*')",
          )
        ).rows,
      ),
    ).toContain("technology_catalog_search");
    expect(
      (
        await db.query(
          "select has_table_privilege('anon','technology_catalog','select') allowed",
        )
      ).rows[0],
    ).toEqual({ allowed: false });
  } finally {
    await db.close();
  }
}, 60000);
