import { pathToFileURL } from "node:url";
import {
  database,
  closeDatabase,
  type Database,
} from "../src/adapters/postgres/client";
import {
  recordUrl,
  sourceUrl,
} from "../src/adapters/sources/structured/discover";
export function parseOptions(args: string[]) {
  const ids = args.filter((arg) => arg.startsWith("--id="));
  if (
    args.some(
      (arg) => !["--all", "--apply"].includes(arg) && !arg.startsWith("--id="),
    ) ||
    ids.length > 1 ||
    (args.includes("--all") ? ids.length !== 0 : ids.length !== 1)
  )
    throw new Error("Specify --id=OSV-ID or --all, with optional --apply");
  if (ids.length) recordUrl("core-osv", ids[0].slice(5));
  return {
    apply: args.includes("--apply"),
    url: ids.length ? sourceUrl("core-osv", ids[0].slice(5)) : undefined,
  };
}
export async function recollectOsv(
  db: Database,
  options: ReturnType<typeof parseOptions>,
) {
  const scope =
    "source_id='core-osv' and status='done' and ($1::text is null or source_url=$1)";
  const {
    rows: [{ until }],
  } = await db.query<{ until: number }>(
    `select coalesce(max(id),0)::float8 until from feed_entries where ${scope}`,
    [options.url ?? null],
  );
  let after = 0,
    selected = 0,
    queued = 0;
  while (after < until) {
    const { rows } = await db.query<{ id: number; fingerprint: string }>(
      `select id::float8 id,fingerprint from feed_entries where ${scope} and id>$2 and id<=$3 order by id limit 100`,
      [options.url ?? null, after, until],
    );
    if (!rows.length) break;
    selected += rows.length;
    for (const entry of rows)
      if (options.apply) {
        const result = await db.query(
          "update feed_entries set status='pending',attempts=0,available_at=now(),lease_token=null,leased_until=null,last_error=null where id=$1 and source_id='core-osv' and status='done' and fingerprint=$2 returning id",
          [entry.id, entry.fingerprint],
        );
        queued += result.rows.length;
      }
    after = rows.at(-1)!.id;
  }
  return { mode: options.apply ? "apply" : "dry-run", selected, queued };
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = parseOptions(process.argv.slice(2));
  await recollectOsv(database(), options)
    .then((result) => console.log(JSON.stringify(result)))
    .catch(() => {
      console.error(
        "Cannot requeue OSV entries; completed batches are retained. Inspect privately and retry.",
      );
      process.exitCode = 1;
    })
    .finally(closeDatabase);
}
