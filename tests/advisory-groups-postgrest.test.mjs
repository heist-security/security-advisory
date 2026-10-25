import { test } from "node:test";
import assert from "node:assert/strict";

// Runs only against the disposable PostgreSQL/PostgREST service in CI, after
// the production upgrade fixture and all three real backfills have completed.
const endpoint = "http://localhost:3001/rpc/query_advisory_groups";
async function groups(options = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filters: { source: "core-cve" },
      p_limit: 1,
      ...options,
    }),
  });
  assert.equal(response.status, 200);
  return response.json();
}
test("PostgREST returns group objects and paginates the populated upgrade", async () => {
  const first = await groups();
  assert.equal(first.length, 1);
  assert.equal(first[0].primary.source_id, "core-cve");
  assert.equal(first[0].members.length, 1);
  const next = await groups({ p_before: first[0].id });
  assert.equal(next.length, 1);
  assert.notEqual(next[0].group_id, first[0].group_id);
  assert.ok(next[0].id < first[0].id);
  const updates = await groups({ updates: true, p_after: 0 });
  assert.equal(updates.length, 1);
  assert.equal(updates[0].change, "published");
  const none = await groups({ filters: { q: "no-such-fixture-phrase" } });
  assert.deepEqual(none, []);
});
