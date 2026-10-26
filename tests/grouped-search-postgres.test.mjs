import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Runs against CI's disposable PostgreSQL 17 database after group-query.sql.
// PostgreSQL 17 chooses different plans from PGlite for this populated search.
test("sparse grouped filters use bounded reads for HTML, JSON and RSS page sizes", () => {
  for (const updates of [false, true]) {
    for (const limit of [20, 21, 100]) {
      for (const [filters, count] of [
        [{ q: "Brotli" }, 2],
        [{ q: "no-such-query-fixture" }, 0],
        [{ type: "patch" }, 2],
        [{ severity: ["critical"] }, 2],
        [{ type: "patch", severity: ["critical"] }, 2],
        [{ type: "patch", severity: ["low"] }, 0],
        [{ type: "mitigation" }, 0],
        [{ important: "1" }, 2],
        [{ fix: "1" }, 2],
      ]) {
        const result = execFileSync(
          "psql",
          ["-XqAt", "-v", "ON_ERROR_STOP=1"],
          {
            input: `set plan_cache_mode=force_generic_plan;
            explain (analyze,buffers,format json)
            select * from query_advisory_groups('${JSON.stringify(filters)}',${limit},null,null,${updates});`,
            encoding: "utf8",
          },
        );
        const plan = JSON.parse(result)[0].Plan;
        assert.equal(plan["Actual Rows"], count);
        const reads = plan["Shared Hit Blocks"] + plan["Shared Read Blocks"];
        assert.ok(
          reads < 3000,
          `${JSON.stringify(filters)}, updates=${updates}, limit=${limit}: ${reads} buffer reads`,
        );
      }
    }
  }
});

test("broad grouped subscriptions remain responsive immediately after 60,000 publications", () => {
  // Compact documents isolate snapshot-member lookup costs from payload I/O.
  // One GIN overlap scan with tens of thousands of keys becomes quadratic;
  // probing each matching event avoids that work, even with a cached plan.
  execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
    input: `truncate documents restart identity cascade;
      alter table advisory_group_updates set (autovacuum_enabled=false);
      set test.group_query_rows='60000';
      set test.group_query_words='1';
      ${readFileSync(new URL("./fixtures/group-query.sql", import.meta.url), "utf8")}
      vacuum analyze events;`,
    encoding: "utf8",
  });
  try {
    // Do not vacuum snapshot membership: reads must stay fast while ingestion
    // is active, rather than depending on when autovacuum drains GIN entries.
    for (const updates of [false, true]) {
      for (const filters of [
        { type: "advisory" },
        { severity: ["high"] },
        { q: "fixture", source: "core-cve" },
      ]) {
        const result = execFileSync(
          "psql",
          ["-XqAt", "-v", "ON_ERROR_STOP=1"],
          {
            input: `set plan_cache_mode=force_generic_plan;
            set statement_timeout='3s';
            select item->>'id' from query_advisory_groups('${JSON.stringify(filters)}',21,null,null,${updates}) item;`,
            encoding: "utf8",
          },
        );
        assert.deepEqual(
          result.trim().split("\n").map(Number),
          Array.from({ length: 21 }, (_, index) => 60000 - index),
        );
      }
    }
  } finally {
    execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
      input: "alter table advisory_group_updates reset (autovacuum_enabled);",
      encoding: "utf8",
    });
  }
});
