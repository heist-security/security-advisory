import {
  database,
  closeDatabase,
  type Database,
} from "../src/adapters/postgres/client";
import { selectedVendorIds } from "../src/adapters/sources/selection";
import { structuredSources } from "../src/adapters/sources/structured/config";
import { pathToFileURL } from "node:url";

export async function configureSources(
  db: Database,
  vendors: string[],
  since: string,
) {
  const ids = [...structuredSources.map((s) => s.id), ...vendors];
  await db.transaction(async (client) => {
    for (const source of structuredSources) {
      const values = {
        ...source,
        verification: { status: "configured", sync: { since } },
        enabled: false,
      };
      const columns = Object.keys(values);
      await client.query(
        `insert into sources(${columns.join(",")}) select ${columns.join(",")} from jsonb_populate_record(null::sources,$1::jsonb)
        on conflict(id) do update set ${columns
          .filter((c) => !["id", "verification", "enabled"].includes(c))
          .map((c) => `${c}=excluded.${c}`)
          .join(",")}`,
        [JSON.stringify(values)],
      );
    }
    await client.query("update sources set enabled=(id=any($1::text[]))", [
      ids,
    ]);
  });
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const vendors = selectedVendorIds();
  const since =
    process.argv.find((a) => a.startsWith("--since="))?.slice(8) ??
    new Date(Date.now() - 86400000).toISOString();
  if (!Number.isFinite(Date.parse(since)) || Date.parse(since) > Date.now())
    throw new Error("Invalid --since timestamp");
  const apply = process.argv.includes("--apply");
  console.log(
    JSON.stringify({
      mode: apply ? "apply" : "dry-run",
      structured_sources: structuredSources.map((s) => s.id),
      selected_vendor_sources: vendors,
      initial_since: since,
      other_sources: "disabled; history retained",
    }),
  );
  if (apply)
    await configureSources(database(), vendors, since)
      .catch(() => {
        console.error(
          "Cannot configure sources; transaction rolled back. Check database readiness privately.",
        );
        process.exitCode = 1;
      })
      .finally(closeDatabase);
}
