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
  // A page must not enumerate every matching event or snapshot in the archive.
  execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
    input: `truncate documents restart identity cascade;
      alter table advisory_group_updates set (autovacuum_enabled=false);
      set test.group_query_rows='60000';
      set test.group_query_words='1';
      ${readFileSync(new URL("./fixtures/group-query.sql", import.meta.url), "utf8")}
      begin;
      set local session_replication_role=replica;
      update events set important=(id%4=0),fix_available=(id%4=0) where id%4=0 or id=1;
      commit;
      vacuum analyze events;`,
    encoding: "utf8",
  });
  try {
    // Do not vacuum snapshot membership: reads must stay fast while ingestion
    // is active, rather than depending on when autovacuum drains GIN entries.
    for (const updates of [false, true]) {
      for (const [filters, stride] of [
        [{ type: "advisory,patch", severity: ["critical", "high"] }, 1],
        [{ type: "advisory" }, 1],
        [{ severity: ["high"] }, 1],
        [{ q: "fixture", source: "core-cve" }, 1],
        [{ important: "1" }, 4],
        [{ fix: "1" }, 4],
      ]) {
        for (const limit of [21, 100]) {
          for (const [after, before] of [
            [null, null],
            [30000, null],
            [null, 40000],
            [59996, null],
          ]) {
            const first =
              after === null
                ? (before ?? 60000 + stride) - stride
                : after + stride;
            const count =
              after === null
                ? limit
                : Math.min(limit, (60000 - after) / stride);
            checkPage({
              filters,
              limit,
              after,
              before,
              updates,
              expected: Array.from(
                { length: count },
                (_, index) =>
                  first + (after === null ? -index : index) * stride,
              ),
              // Include first-call planning overhead, with a page-size budget.
              budget: 2000 + limit * 40,
            });
          }
        }
      }
    }
    // Production can have a run of unrelated publications ahead of the next
    // match. A fixed recent window followed by an archive scan regresses here.
    execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
      input: `begin;
        set local session_replication_role=replica;
        update events set severity_keys=array['low'],important=false,fix_available=false
          where id>59000 or id between 30001 and 31000;
        commit;
        vacuum analyze events;`,
      encoding: "utf8",
    });
    for (const updates of [false, true]) {
      for (const [filters, stride] of [
        [{ type: "advisory,patch", severity: ["critical", "high"] }, 1],
        [{ important: "1" }, 4],
        [{ fix: "1" }, 4],
      ]) {
        for (const limit of [21, 100]) {
          for (const [after, before, first] of [
            [null, null, 59000],
            [30000, null, 31000 + stride],
            [null, 31001, 30000],
          ]) {
            checkPage({
              filters,
              limit,
              after,
              before,
              updates,
              expected: Array.from(
                { length: limit },
                (_, index) =>
                  first + (after === null ? -index : index) * stride,
              ),
              // Allow the 1,000-row gap, without enumerating all 60,000 matches.
              budget: 8000 + limit * 20,
            });
          }
        }
      }
    }
  } finally {
    execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
      input: "alter table advisory_group_updates reset (autovacuum_enabled);",
      encoding: "utf8",
    });
  }
});

function checkPage({
  filters,
  limit,
  after,
  before,
  updates,
  expected,
  budget,
}) {
  const query = `query_advisory_groups('${JSON.stringify(filters)}',${limit},${after},${before},${updates})`;
  const sql = (input) =>
    execFileSync("psql", ["-XqAt", "-v", "ON_ERROR_STOP=1"], {
      input:
        "set plan_cache_mode=force_generic_plan; set statement_timeout='3s';" +
        input,
      encoding: "utf8",
    });
  const ids = sql(`select item->>'id' from ${query} item;`)
    .trim()
    .split("\n")
    .map(Number);
  assert.deepEqual(ids, expected, query);
  const plan = JSON.parse(
    sql(`explain (analyze,buffers,format json) select * from ${query};`),
  )[0].Plan;
  const reads = plan["Shared Hit Blocks"] + plan["Shared Read Blocks"];
  assert.ok(reads < budget, `${query}: ${reads} buffer reads`);
}
