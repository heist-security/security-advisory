import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";
import catalog from "../src/lib/technology-families.json";
import { technologyFamily } from "../src/lib/technology";

it("indexes canonical families for historical and future rows without rewriting routing history", async () => {
  const db = new PGlite();
  try {
    await db.exec(
      "create role anon; create role authenticated; create role service_role; create table events(id bigint primary key, technologies text[]);",
    );
    const unified = readFileSync(
      new URL(
        "../supabase/migrations/202610240004_unified_feed.sql",
        import.meta.url,
      ),
      "utf8",
    );
    await db.exec(
      unified.slice(
        unified.indexOf("create function public.technology_key"),
        unified.indexOf("create function public.text_union"),
      ),
    );
    await db.exec(
      "insert into events select n,array[case when n<=2 then 'node-js-8' else 'unrelated-package' end] from generate_series(1,20000) n;",
    );
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610250010_technology_families.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const values = [
      ...catalog.flatMap((f) => [
        f.label,
        ...f.aliases,
        ...f.aliases.map((a) => a + "-22-10-3"),
      ]),
      "node-gyp",
      "node-red",
      "nodejs-nodemon",
      "python-pillow",
      "react-dom",
      "C++",
      "C#",
    ];
    const normalized = await db.query<{ key: string }>(
      "select canonical_technology(value) key from unnest($1::text[]) value",
      [values],
    );
    expect(normalized.rows.map((r) => r.key)).toEqual(
      values.map(technologyFamily),
    );
    await db.exec(
      "insert into events values(20001,array['nodejs-100','renamed-product']); analyze events;",
    );
    const sql =
      "select id from events where technology_families(events) && array['node-js'] order by id desc limit 2";
    expect(
      (await db.query<{ id: number }>(sql)).rows.map((r) => Number(r.id)),
    ).toEqual([20001, 2]);
    expect(
      (
        await db.query<{ technologies: string[] }>(
          "select technologies from events where id=1",
        )
      ).rows[0].technologies,
    ).toEqual(["node-js-8"]);
    expect(
      (
        await db.query<{ count: number }>(
          "select count(*)::integer count from events",
        )
      ).rows[0].count,
    ).toBe(20001);
    const plan = JSON.stringify(
      (
        await db.query(
          "explain (format json) select id from events where technology_families(events) && array['node-js']",
        )
      ).rows,
    );
    expect(plan).toContain("events_technology_families");
    const permissions = await db.query<{ anon: boolean; service: boolean }>(
      "select has_function_privilege('anon','technology_families(events)','execute') anon, has_function_privilege('service_role','technology_families(events)','execute') service",
    );
    expect(permissions.rows[0]).toEqual({ anon: false, service: true });
  } finally {
    await db.close();
  }
}, 60000);
