# Operations

The service uses a direct PostgreSQL connection. Supabase remains supported for hosting and migrations; the runtime no longer uses PostgREST or a Supabase API key.

## Required runtime settings

- `DATABASE_URL`: server-side PostgreSQL URL; use a provider-supported pooler for serverless deployments. The runtime limits its pool to three connections per process.
- `DATABASE_CA_CERT`: trusted provider CA certificate when required. Remote connections always verify certificates. Local loopback development connections may use plaintext.
- `CRON_SECRET`: random bearer token for ingestion and health endpoints.
- `PUBLIC_BASE_URL`: canonical HTTPS public origin.
- Optional publisher settings are described in [publisher activation](publisher-activation.md). Structured ingestion requires no model credentials.

`SUPABASE_DB_URL` and `SUPABASE_DB_CA_CERT` remain supported aliases for release automation. `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are no longer used. Keep production database/model credentials out of Preview and untrusted PR workflows.

## Canonical-feed cutover

This is a breaking application/database change. Schedule a maintenance window, pause ingestion scheduling, take a database backup, and configure the new runtime connection before releasing. Old application instances cannot serve their former models after cutover. Do not deploy an older build against the new schema.

1. Apply migrations through `202610260021_canonical_feed.sql` with the existing release workflow or `supabase db push`. The migration creates canonical storage, fences old document claims/publications, and preserves queued work.
2. Run `npm run feed:migrate`. The release runner does this automatically after schema application. It imports the latest revision of every existing source claim using the same domain rules as live ingestion, committing bounded batches and a durable checkpoint.
3. The final transaction removes obsolete projections/functions and moves original source event history into `feed_archive.events` and `feed_archive.advisories`. Source bodies remain in `documents`; extraction results are stored beside them. The service role can read the archive but cannot write it. The app does not depend on it.
4. Deploy the checked application commit, verify `/api/v1/items`, RSS, item details, filters and authenticated health, then resume scheduling. Migrate consumers to the new item URLs and fresh cursors/subscriptions.

No historical migration file should be edited or reapplied manually. If import fails, the release stops before deployment. Fix the underlying issue privately and rerun; committed batches are retained. Reads and processing fail closed while import is incomplete. Rollback requires restoring the pre-cutover database backup together with the previous application; an application-only rollback is insufficient.

The importer reuses existing normalized evidence and makes no paid extraction calls. Old patch records without explicit `fixed_cves` evidence stay separate. If those should be combined, intentionally recollect/reprocess the source under the normal publisher budget; the importer does not infer a fix relationship from related CVEs.

## Release workflow

Migration `202610270022_technology_search.sql` builds the indexed technology dictionary from current items once and installs transactional maintenance triggers. It briefly blocks item writes during installation; normal feed reads continue. Apply it before the paginated suggestion endpoint is deployed. It does not rerun the canonical feed import.

GitHub Actions checks formatting, types, tests, build and secrets. It validates a populated migration upgrade and a second no-op schema push against disposable PostgreSQL 17. Browser checks use the real PostgreSQL adapter. Production runs are serialized through migration and deployment readiness.

The release job requires GitHub environment secrets `SUPABASE_DB_URL` (with `sslmode=verify-full`), `SUPABASE_DB_CA_CERT`, and `VERCEL_TOKEN`; `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` are environment variables. It verifies the repository, main commit and Vercel link, applies migrations, imports items, and requests an exact-commit deployment. Runtime database settings must also be configured on Vercel. The workflow installs project dependencies before running the TypeScript importer.

Schema lock timeouts/deadlocks are retried with a bounded delay. Ambiguous transport failures stop the release. Import errors never print raw database diagnostics or source data; inspect private provider logs/database state. A superseded commit skips deployment. Migration completion does not imply application readiness.

## Ingestion and monitoring

Poll discovers entries, collect fetches and stores documents, process normalizes and publishes them. The source checkpoint advances only after every discovered batch is durably staged. Replays are idempotent. Expired leases are fenced; failures retry with backoff and stop after five attempts. Paid extraction claims share an hourly database-enforced attempt limit; this is not a currency spending cap.

`/api/cron/health` returns 503 for failed/overdue sources, failed queue entries, old pending work, missing structured-source configuration, or incomplete migration. Monitor it externally. Batch/concurrency settings are in `.env.example`. Provider limits, expired CVE delta history and extraction-quality failures need operator investigation; do not skip gaps by moving a checkpoint to now.

Source selection is explicit. `npm run sources:configure` previews it; `--apply` changes enablement transactionally without resetting checkpoints or deleting history. Set the same `VENDOR_SOURCE_IDS` in the CLI and runtime. Disable a source row to pause its claims immediately. Changing environment settings requires deployment. Re-enabling a source does not reset exhausted jobs.

## Audit and verification

`documents` contains source bodies and completed normalized extractions. `feed_items.records` contains the current source claims. `feed_archive` contains pre-cutover source history, including intermediate revisions. Feed change cursors are a current-state synchronization mechanism, not an immutable historical log.

Run `npm run check`, `npm run build`, and browser tests before release. Use `TEST_DATABASE_URL` only for a disposable PostgreSQL instance with database-creation privileges; tests create and remove isolated databases. For a live read-only parser smoke test use `npm run sources:verify-structured`. Local tests do not establish live coverage, load capacity, model quality or production deployment success.
