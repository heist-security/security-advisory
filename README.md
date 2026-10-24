# Heist Feed

Standalone Next.js + Supabase starter for `feed.heist.security`: public RSS and JSON endpoints backed by a durable announcement ingestion pipeline. Designed to catch patches and mitigations even when no new CVE is assigned.

## Included

- Public homepage, `/feed.xml`, and `/api/v1/events` with CORS and bounded responses.
- Hundreds of curated, live-checked RSS/Atom streams, covering runtimes, web libraries, databases, native parsers, cloud infrastructure, identity, CI, AI stacks, operating systems, and vendor advisories. Each source has an explicit HTTPS origin allowlist. See [the full source audit](docs/source-coverage.md) for exact counts, the catalog, and excluded candidates.
- Public `/sources` browser and `/api/v1/sources` catalog, separating dedicated advisories, mixed announcements, and upstream release notes.
- Separate full-article and inline-release adapters. Publisher feed titles retain project identity for version-only entry titles; synthesized tag-only entries are skipped.
- Full-article extraction, content change detection, retained source text, and retryable database jobs.
- OpenAI Responses structured extraction with exact-quote checks for product, version, prerequisites, CVE, and stated severity fields.
- Stable advisory IDs by source URL and immutable event IDs for revisions. Related CVEs never serve as deduplication keys.
- Document and source leases, stale-worker fencing, source failure backoff, conditional HTTP for inline feeds, and failed documents after five attempts. Atomic publication ordered for incremental consumers.
- Configurable bounded batches/concurrency and per-minute schedules suitable for polling the larger registry.

This is an initial implementation, not a deployed or comprehensive feed. No example advisories are published as live data. The model and production database require configuration and live evaluation before launch. Quote checks establish textual support, not semantic correctness: a quoted version could still be associated with the wrong product. Machine extraction is explicitly labeled.

## Run locally

Requires Node.js 22+ and a new Supabase project.

1. Run `npm ci` and copy `.env.example` to `.env.local`.
2. Apply **all three migrations in filename order** from `supabase/migrations/`. The first creates the database, the second adds source metadata/leases, and the third seeds the verified catalog. Prefer linking a new project with the Supabase CLI and running `supabase db push`. Existing installations of the first version should apply only migrations 002 and 003.
3. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, and `OPENAI_MODEL` (a model enabled in your account supporting Responses structured outputs).
4. Generate `CRON_SECRET` with `openssl rand -hex 32`. Set `PUBLIC_BASE_URL=http://localhost:3000` locally.
5. Run `npm run dev`. The homepage works without credentials; data endpoints return 503 until the database is configured.
6. Invoke the authenticated collectors to populate the feed:

```sh
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process
```

The shell must have `CRON_SECRET` set; Next.js reading `.env.local` does not export it into your shell. Each poll invocation claims up to 12 due sources with concurrency four and checks up to 30 current entries per source, including older entries still present in feeds. Original publication dates and ingestion publication dates remain separate. Repeat the collectors or let cron run until the initial queue is drained. The first sweep can enqueue thousands of entries: configure a provider spending limit and watch queue depth before enabling the full production schedule. Non-security release notes are classified by the model rather than discarded by a keyword filter.

## Deploy to Vercel

1. Import [heist-security/security-advisory](https://github.com/heist-security/security-advisory) into Vercel as a Next.js project.
2. Add the environment variables above to the production environment only. All keys are server-only; none have a `NEXT_PUBLIC_` prefix. Use a separate database and disable cron credentials for previews.
3. Deploy. The supplied schedules require a Vercel plan supporting sub-daily cron (currently Pro); Hobby is limited to daily runs. An external scheduler can instead invoke the same protected endpoints.
4. Add `feed.heist.security` in Vercel's project Domains screen, then set exactly the DNS record Vercel provides. Set `PUBLIC_BASE_URL=https://feed.heist.security` and redeploy if changed.
5. Verify RSS, JSON, queue processing, and source health before announcing the service.

Neither Vercel nor Supabase resources are provisioned by these files. DNS changes, service credentials, and an extraction model are still required.

## Consumer API

`GET /api/v1/events` returns the latest 30 events, newest first.

`GET /api/v1/events?after=0&limit=100` returns events in ascending ID order. Persist `next_after` and repeat to backfill or follow new events. An empty response preserves your cursor. IDs can have gaps; do not calculate the next ID yourself.

Optional filters: `kind=patch|advisory|mitigation|withdrawal|other` and `cve=CVE-YYYY-NNNN`. Keep filters stable while using a cursor; use a new cursor if you change your subscription. For an unfiltered complete archive, begin with `after=0`. The default newest-first response is a snapshot, not a full backfill.

```json
{
  "schema_version": "1",
  "data": [],
  "next_after": 0
}
```

Each event includes `id`, `advisory_id`, `revision`, `source_id`, `source_url`, `source_published_at`, `published_at`, `extraction_method`, and `payload`. The payload carries title, summary, kind, products with evidenced version/prerequisite fields, related CVEs, and stated severity. Missing CVEs are an empty array; unknown severity stays `unknown`. Version strings preserve publisher wording and are **not** executable semver constraints.

`GET /feed.xml` contains the latest 100 events. RSS GUIDs identify revisions, so patch updates can notify again. Use JSON for backfill. Responses are publicly cacheable for 60 seconds with a five-minute stale window. No client key is required. Configure Vercel rate controls before broad public use.

## Source coverage and operations

The checked-in `sources/registry.json` is the reviewed catalog; migration 003 seeds it into the database `sources` table. The public source catalog is the version shipped with the application, not a live uptime view or a count of currently enabled database rows. Operators may disable individual database sources without rewriting the historical verification report. Only operators can change source URLs. Redirect destinations need an allowed origin. GitHub release links are also restricted to the reviewed repository path. Raw articles are never exposed by the public API, and anonymous Supabase table/RPC access is denied.

To extend or recheck the catalog:

1. Edit `sources/candidates.json`, including channel type, category, adapter, publisher provenance, rationale, limitations, origin allowlist, and target interval.
2. Run `npm run sources:verify` with outbound HTTPS access. It checks candidates with bounded concurrency and writes `sources/verification.json` and the accepted `sources/registry.json`. `-- --resume` reuses checks only when the configuration fingerprint and verifier version match; a normal run rechecks everything. A narrow `-- --refresh-inline` refreshes currently accepted inline sources after an adapter change.
3. Review exclusions and warnings. A reachable feed alone is insufficient: there must be a usable document. Do not enable failed candidates to reach a count target.
4. Run `npm run sources:build` to generate the catalog seed and `docs/source-coverage.md`, then run the tests. Once migration 003 has been applied in production, preserve that migration and put subsequent registry changes in a **new** migration instead of rewriting production history. The current generator targets the initial, not-yet-deployed catalog.

The verifier records timestamps, publisher URLs, a sample document URL, an extracted-text SHA-256 and length, feed/item counts, configuration fingerprints, and warnings. The coverage audit includes all rejected candidates and their reasons. `sources/maintenance-review.json` records a follow-up on stale GitHub streams, including archived/deprecated upstreams and documented successors. That check is retrieval/parser validation, not live model accuracy or a guarantee of future feed availability.

- Both cron endpoints run every minute. The poller claims up to `POLL_BATCH_SIZE=12` due sources, with `POLL_CONCURRENCY=4` sources in flight and three article fetches per source. Each source has its own target interval (typically 30–120 minutes). The worker claims up to `PROCESS_BATCH_SIZE=24` documents with `PROCESS_CONCURRENCY=4`. These are ceilings, not guaranteed throughput; deadlines stop new work before the 300-second function limit.
- The configured ceilings are 720 source claims/hour and 1,440 extraction attempts/hour. Actual capacity depends on latency, function overlap, model rate limits, database operations, failures, and deadlines. The registry's target polling demand is below this claim ceiling, but no production load or cost test is claimed. Watch source lag and oldest pending document age and tune the environment variables or use additional workers as needed. Database leases support overlapping invocations.
- Inspect `sources.last_checked_at`, `last_polled_at`, `next_poll_at`, `consecutive_failures`, and `last_error`; inspect `documents` grouped by `status`, oldest pending age, attempts, and `last_error`. Source failures back off from five minutes up to six hours; a successful poll restores its configured interval. Failed jobs are retained. Vercel does not automatically retry failed cron invocations; the next cron reclaims expired leases or scheduled retries.
- To retry failed documents after fixing an adapter/configuration, set their status to `pending`, attempts to `0`, and available_at to `now()` using a scoped SQL update.
- LLM calls only occur for changed extracted text. Inline feeds use persisted ETag/Last-Modified validators. Article feeds are fetched and their articles rechecked even if the feed itself was unchanged, because a patch can edit a linked article without changing the RSS. Partial poll failures clear validators so failed documents will be retried. Missing model/key configuration fails before claiming documents rather than exhausting their retries. Raw history is retained for reproducibility; define archival and retention policy as volume grows.
- The general HTML extractor rejects empty/oversized articles rather than truncating security facts. Some vendor sites need dedicated selectors or adapters. It only watches the current feed window; edits to older entries that leave that window are not discovered.
- Different sources about the same incident remain distinct, linked by `related_cves` where available. Cross-source product correlation and semantic change suppression are future work. A changed article can produce a revision even if the security meaning is unchanged. Explicit retractions can become `withdrawal` events; a page disappearing does not automatically retract previous data.
- OSV is not wired into this standalone project. Add a structured OSV adapter separately; it should not need LLM extraction. The existing Heist OSV PR remains separate.

The Ruby scenario is supported because a runtime patch announcement does not need its own CVE. Whether the specific post is found depends on its presence in the selected feed window and successful article retrieval/extraction. The no-CVE patch regression test checks the publication path; it is not a live-model accuracy claim.

## Validation

```sh
npm test
npm run typecheck
npm run build
```

Tests cover evidence validation, no-CVE patches, URL/redirect/path restrictions, relative/legacy HTTP links, tag-only entries, challenge pages, conditional requests, XML safety/escaping, cron auth, batch collection and partial retry behavior, registry fingerprints/seed integrity, and all migrations against embedded PostgreSQL (PGlite): document/source leases, backoff, revisions, reversion, publication ordering, and role permissions. Production Supabase REST/RLS behavior, OpenAI accuracy/cost, and Vercel cron execution still need live verification after configuration.

## References

- [Next.js route handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- [Vercel cron operation and auth](https://vercel.com/docs/cron-jobs/manage-cron-jobs)
- [Vercel cron plans](https://vercel.com/docs/cron-jobs/usage-and-pricing)
- [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security)

The API is designed for open, unauthenticated consumption. No source-code license or blanket redistribution license for upstream content is implied; choose the project's license before publishing its repository, and retain source attribution.
