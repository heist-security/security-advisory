import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

// Runs against CI's disposable PostgreSQL 17 database after group-query.sql.
// PostgreSQL 17 chooses different plans from PGlite for this populated search.
test("sparse grouped searches use bounded reads for HTML, JSON and RSS page sizes", () => {
  for (const updates of [false, true]) {
    for (const limit of [20, 21, 100]) {
      for (const q of ["Brotli", "no-such-query-fixture"]) {
        const result = execFileSync(
          "psql",
          ["-XqAt", "-v", "ON_ERROR_STOP=1"],
          {
            input: `set plan_cache_mode=force_generic_plan;
            explain (analyze,buffers,format json)
            select * from query_advisory_groups('{"q":"${q}"}',${limit},null,null,${updates});`,
            encoding: "utf8",
          },
        );
        const plan = JSON.parse(result)[0].Plan;
        assert.equal(plan["Actual Rows"], q === "Brotli" ? 2 : 0);
        const reads = plan["Shared Hit Blocks"] + plan["Shared Read Blocks"];
        assert.ok(
          reads < 3000,
          `${q}, updates=${updates}, limit=${limit}: ${reads} buffer reads`,
        );
      }
    }
  }
});
