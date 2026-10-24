import { db } from "../src/lib/db";
import { selectedVendorIds } from "../src/lib/vendor-config";
import { structuredSources } from "../src/lib/structured/config";

// Application configuration only. Uses existing tables; never creates or changes a schema.
const vendors = selectedVendorIds();
const argument = process.argv.find((a) => a.startsWith("--since="))?.slice(8);
const since = argument ?? new Date(Date.now() - 86400000).toISOString();
if (!Number.isFinite(Date.parse(since)) || Date.parse(since) > Date.now())
  throw new Error("Invalid --since timestamp");
const ids = [...structuredSources.map((s) => s.id), ...vendors];
console.log(
  JSON.stringify({
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    structured_sources: structuredSources.map((s) => s.id),
    selected_vendor_sources: vendors,
    initial_since: since,
    other_sources: "disabled; history retained",
  }),
);
if (process.argv.includes("--apply")) {
  const client = db();
  const existing = await client
    .from("sources")
    .select("id,enabled,verification");
  if (existing.error)
    throw new Error(
      "Cannot read source configuration; check database readiness",
    );
  const previous = new Map(existing.data.map((s) => [s.id, s]));
  // Keep core IDs disabled until every row is registered; repeat safely after an interruption.
  const rows = structuredSources.map((source) => ({
    ...source,
    enabled: previous.get(source.id)?.enabled ?? false,
    verification: previous.get(source.id)?.verification ?? {
      status: "configured",
      sync: { since },
    },
  }));
  const inserted = await client
    .from("sources")
    .upsert(rows, { onConflict: "id" });
  if (inserted.error) throw new Error("Cannot register structured sources");
  const disabled = await client
    .from("sources")
    .update({ enabled: false })
    .not("id", "in", `(${ids.join(",")})`);
  if (disabled.error) throw new Error("Cannot disable unselected sources");
  const enabled = await client
    .from("sources")
    .update({ enabled: true })
    .in("id", ids);
  if (enabled.error) throw new Error("Cannot enable selected sources");
  console.log(
    "Source configuration saved. Existing checkpoints and historical documents/events retained.",
  );
}
