import { pathToFileURL } from "node:url";
import { db } from "../src/lib/db";
import { recordUrl, sourceUrl } from "../src/lib/structured/discover";

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
  client: ReturnType<typeof db>,
  options: ReturnType<typeof parseOptions>,
) {
  const scope = () => {
    let query = client
      .from("feed_entries")
      .select("id,fingerprint")
      .eq("source_id", "core-osv")
      .eq("status", "done");
    if (options.url) query = query.eq("source_url", options.url);
    return query;
  };
  // Freeze the upper bound and walk by ID so concurrent collection/polling
  // cannot extend this run or cause offset pagination to skip entries.
  const newest = await scope().order("id", { ascending: false }).limit(1);
  if (newest.error) throw new Error("Cannot read completed OSV entries");
  const until = newest.data?.[0]?.id;
  let after = 0,
    selected = 0,
    queued = 0;
  while (until && after < until) {
    const batch = await scope()
      .gt("id", after)
      .lte("id", until)
      .order("id")
      .limit(100);
    if (batch.error) throw new Error("Cannot read completed OSV entries");
    if (!batch.data?.length) break;
    for (const entry of batch.data) {
      selected++;
      if (options.apply) {
        const result = await client
          .from("feed_entries")
          .update({
            status: "pending",
            attempts: 0,
            available_at: new Date().toISOString(),
            lease_token: null,
            leased_until: null,
            last_error: null,
          })
          .eq("id", entry.id)
          .eq("source_id", "core-osv")
          .eq("status", "done")
          .eq("fingerprint", entry.fingerprint)
          .select("id");
        if (result.error)
          throw new Error("Cannot requeue OSV entry " + entry.id);
        queued += result.data?.length ?? 0;
      }
      after = entry.id;
    }
  }
  return { mode: options.apply ? "apply" : "dry-run", selected, queued };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const options = parseOptions(process.argv.slice(2));
  console.log(JSON.stringify(await recollectOsv(db(), options)));
}
