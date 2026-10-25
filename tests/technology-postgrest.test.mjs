import { test } from "node:test";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

// This endpoint is exclusively the disposable PostgREST/PostgreSQL CI service.
test("PostgREST filters indexed technology families before pagination", async () => {
  const query = new URLSearchParams({
    select: "id,technologies,technology_families",
    technology_families: "ov.{node-js}",
    severity_keys: "ov.{high}",
    event_types: "cs.{advisory}",
    order: "id.asc",
    limit: "2",
  });
  let response;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      response = await fetch("http://127.0.0.1:3001/events?" + query, {
        signal: AbortSignal.timeout(2000),
      });
    } catch {}
    if (response?.ok) break;
    await setTimeout(500);
  }
  assert.equal(response?.status, 200);
  const first = await response.json();
  assert.deepEqual(
    first.map((e) => e.id),
    [1, 3],
  );
  assert.deepEqual(first[0].technologies, ["node-js-8"]);
  assert.deepEqual(first[0].technology_families, ["node-js"]);
  query.set("id", "gt.3");
  const next = await fetch("http://127.0.0.1:3001/events?" + query);
  assert.equal(next.status, 200);
  assert.deepEqual(
    (await next.json()).map((e) => e.id),
    [4],
  );
});
