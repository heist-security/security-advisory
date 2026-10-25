import { readFileSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { expect, it } from "vitest";

it("uses the search index for an older rare technology instead of walking recent event IDs", async () => {
  const database = new PGlite();
  try {
    await database.exec(`
      create role anon; create role authenticated; create role service_role;
      create table events (
        id bigint primary key, source_id text, payload jsonb,
        technologies text[], cve_ids text[], event_types text[]
      );
    `);
    await database.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/202610240005_feed_search.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    await database.exec(`
      insert into events
      select n,'fixture',jsonb_build_object('products',jsonb_build_array(jsonb_build_object('name',jsonb_build_object('value',case when n<=80 then 'Ruby' else 'Node.js' end)))),
        array[case when n<=80 then 'ruby' else 'node-js' end],array[]::text[],array['patch']
      from generate_series(1,20000) n;
    `);
    // Flush the GIN pending list and gather statistics, as autovacuum does in
    // steady state. Assert plan shape, not machine-dependent timing.
    await database.exec("vacuum analyze events");
    const query = `select technologies,payload->'products' products from events
      where search_document @@ to_tsquery('simple','ruby:*') order by technologies limit 100`;
    const result = await database.query<{ technologies: string[] }>(query);
    expect(result.rows).toHaveLength(80);
    expect(result.rows.every((row) => row.technologies.includes("ruby"))).toBe(
      true,
    );
    const plan = JSON.stringify(
      (await database.query("explain (format json) " + query)).rows,
    );
    expect(plan).toContain("events_search_document");
    expect(plan).not.toContain("events_pkey");
  } finally {
    await database.close();
  }
}, 30000);
