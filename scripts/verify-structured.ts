import { failureReason } from "../src/application/errors";
import { discover } from "../src/adapters/sources/structured/discover";
import { structuredIds } from "../src/adapters/sources/structured/config";
import { structuredDocument } from "../src/adapters/sources/structured/documents";
import { riskContext } from "../src/adapters/risk/provider";

// Read-only transport/parser smoke check. No database access, model calls or quality claims.
let failed = false;
for (const id of structuredIds) {
  try {
    const result = await discover(
      id,
      { since: new Date(Date.now() - 86400000).toISOString() },
      3,
    );
    const selected = result.items.slice(0, 3);
    for (const item of selected) await structuredDocument(id, item);
    console.log(
      JSON.stringify({
        source: id,
        status: "ok",
        checked_at: new Date().toISOString(),
        sample_ids: selected.map((r) => r.structured.id),
        entries_in_page: result.items.length,
        more: result.more,
      }),
    );
  } catch (error) {
    failed = true;
    console.log(
      JSON.stringify({
        source: id,
        status: "failed",
        reason: failureReason(error),
      }),
    );
  }
}
const risk = await riskContext(["CVE-2021-44228"], true);
console.log(JSON.stringify({ risk_sources: risk.availability }));
if (Object.values(risk.availability).some((s) => s === "unavailable"))
  failed = true;
if (failed) process.exitCode = 1;
