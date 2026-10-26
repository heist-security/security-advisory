# Operations and launch checks

## Feed read model migration — 26 October 2026

`202610260020_feed_read_model.sql` replaces the proposed adaptive-query patch
with separate relational read models for current groups and historical updates.
The release runner completes `backfill_advisory_feed(100)` after the existing
backfills and before application deployment. Inspect `advisory_feed_backfill`
for progress; retry resumes committed batches. Do not reset its checkpoint or
deploy the new application before completion. Existing application instances
continue serving through the compatibility RPC during the copy.

The backfill only copies membership and filtering metadata. It preserves event
IDs, update IDs, payloads, subscription cursors, and notification history.
Publication maintains both models transactionally after migration. See
[feed storage and queries](advisory-grouping.md#feed-storage-and-queries) for
the schema and compatibility behavior. Verify both the original critical-patch
URL and `/?view=grouped&type=advisory%2Cpatch&severity=critical%2Chigh` after
production deployment; local performance checks do not establish live recovery.

## Schema migration lock retry — 26 October 2026

Production run [40298637801](https://github.com/heist-security/security-advisory/actions/runs/40298637801)
passed CI but stopped before deployment when the schema push hit a database lock
timeout. Retrying the failed release completed migrations at 09:25 UTC and
deployed commit `855cdaae94c69c8fca75dcdc3e5de256ab0e43ad` successfully.
Post-release checks loaded the original critical-patches URL in 0.45–0.57
seconds, but the broader `important=1` filter still returned unavailable
responses. Migration recovery does not establish full feed reliability.

The release runner now retries schema pushes only after PostgreSQL reports a
lock timeout or deadlock, up to five retries with bounded backoff within the
existing eight-minute schema deadline. Each push rechecks migration history;
committed migrations are skipped and the failed transaction is retried.
Connection failures, client timeouts, query cancellations, and other SQL errors
still stop the release. Backfills and deployment start only after schema success.
The successful production retry used the previous runner; automatic schema
retries take effect after this follow-up is merged.

## Intermittent filtered-feed failures — 26 October 2026

Read-only checks reproduced “Feed temporarily unavailable” twice for
`/?view=grouped&severity=critical&type=patch`, each after about eight seconds.
An empty mitigation/low-severity combination also failed, while broader filters
and text search succeeded. Production database diagnostics were unavailable;
the timing is consistent with a query timeout.

Migration `202610260019_grouped_filters.sql` resolves all filter combinations
through event indexes before looking up current groups or historical snapshots.
Previously only text searches took that path. Snapshot lookups probe each
matching event separately and deduplicate before pagination, avoiding expensive
large-array overlap queries for broad subscriptions. No backfill is required.
The snapshot-member index uses immediate GIN updates and drains its existing
pending list during migration: otherwise every event lookup rescans pending
entries until autovacuum catches up, making reads slow just after ingestion.
Regression checks cover sparse/empty filters, cursors, corrections, and broad
subscriptions immediately after 60,000 publications with snapshot autovacuum
disabled.

Failed feed reads now log the duration, view, filter names, and a known database
error category. They omit filter values and raw error messages. After the normal
production release applies this migration and deploys the application, repeat
the failing URLs and inspect `feed_query` logs for query cancellations, lock
waits, or connection failures. Local verification does not establish production
recovery.

## Release lock contention — 26 October 2026

Production run [40275054364](https://github.com/heist-security/security-advisory/actions/runs/40275054364)
failed during the technology backfill with a database lock timeout, before
creating a Vercel deployment. Retrying the failed job completed migrations and
confirmed commit `b54ecf2bad349594f0cd320903236c837dfba8d1` ready at 05:57 UTC.
The homepage, source catalog, JSON feeds (ordinary and grouped), technology
endpoint and RSS subsequently returned HTTP 200; RSS contained 100 items.

The follow-up migration `202610260016_completed_backfills.sql` makes completed
priority, technology and grouping backfills return their recorded checkpoint
without acquiring the publication lock. Incomplete backfills retain the existing
lock order and recheck completion under lock. It does not reset checkpoints or
replay historical events. The release runner retries only database lock timeouts
and deadlocks, at most five consecutive retries with bounded backoff, retaining
the five-second lock timeout, 30-second statement timeout and overall deadline.
Other failures still stop deployment. Migration CI holds the publication lock in
a separate PostgreSQL session to verify both the completed fast path and recovery
of unfinished work. This prevention change takes effect after its PR is merged;
the successful production retry above used the previous release runner.

## Feed freshness follow-up — 25 October 2026

Monitoring confirmed publisher publications, including the Ruby/GitLab regexp
announcement ([event 19319](https://feed.heist.security/api/v1/events?after=19318&limit=1)),
but also found inconsistent public reads. At 06:03 UTC, RSS and the default JSON
query returned event 21918 (05:53 UTC), while a different valid page size returned
event 22549 (06:03 UTC). Earlier, an unchanged incremental cursor returned an empty
page while newer records existed. These are read freshness failures, not evidence
that ingestion stopped.

The remediation removes the persistent event-result cache, makes HTML/RSS/JSON
event reads dynamic, disables caching on database fetches, and sends `no-store`
for event API/RSS responses (including empty cursor pages). This trades cache hits
for one bounded database read per feed request; monitor database latency and
request volume after deployment. Existing query limits and the public rate limit
remain the load controls. Source catalog and risk-response cache policies are
unchanged.

The production-build regression fixture checks identical URLs before and after
publication, including an initially empty cursor, plus database outage and
recovery. After merge and deployment, repeat these checks on the exact deployed
commit: poll the same cursor across a new publication, confirm RSS/JSON/HTML
advance, and check response cache headers. A local test is not live deployment
verification.

The public records are marked `llm`; independent OpenAI token-usage/completion
verification remains pending because authenticated runtime access was unavailable
during monitoring. Extraction evaluation, complete coverage, backfill completion,
and continuous 24-hour observation are not established by these checks.

## Publisher activation follow-up — 24 October 2026

The operator requested a PR to activate all 374 reviewed publisher feeds and create a restricted OpenAI key. See [publisher activation](publisher-activation.md) for the production configuration, 60-attempt/hour limit, shared-project funding boundary, merge-time migration and remaining evaluation gates. This supersedes earlier instructions to leave the vendor selection empty for this deployment. Live activation is not claimed until this PR is merged and its exact release is verified.

## Cron activation and first publications — 24 October 2026

The [production run for `70439a1`](https://github.com/heist-security/security-advisory/actions/runs/40129932369) completed migrations at 20:29 UTC and reported the exact commit ready on Vercel at 20:30 UTC. The production domain serves the application over HTTPS. The operator then requested cron activation; all three jobs are now enabled every minute. This supersedes the paused-cron status in the earlier records below.

The first poll rejected all three database source rows because `discovery_notes` was SQL `NULL`, while the application accepted only an omitted field or a string. A targeted update changed only those three null metadata values to empty strings and made the failed sources due for retry; no schema, checkpoint or historical data changed. The application now accepts null metadata, with a regression test against actual migration-created rows.

After retry, CVE and KEV staged 3,756 entries. Scheduled collection and deterministic processing published real events: a read-only database check at approximately 20:47 UTC found 27 CVE and 500 KEV events. The public JSON API and homepage showed populated results, and RSS returned HTTP 200 with 100 items. No model calls are required by this configuration. These counts are a point-in-time observation, not a completed backfill.

OSV remains blocked on the deployed commit by `structured_backfill_required`: the requested month contains approximately 595,000 index rows, above the old 200,000-row cap. Its September 24 checkpoint has not been advanced or reset. This follow-up changes OSV discovery to retain only the next page of records while scanning a bounded index prefix. A read-only local replay of the downloaded production index returned two 2,000-record pages without overlap and preserved the initial timestamp. This fix must be reviewed and deployed before claiming live OSV success; see [capacity limits](structured-sources.md#checkpoints-and-capacity).

Full backfill completion, authenticated external monitoring, live database-role isolation, corrections/withdrawals, cache/rate-limit load checks and the 24-hour observation period remain unverified. The operator reported completing the credential handoff before activation; independent verification of old-key revocation is not recorded here. No additional migrations were implemented or applied during cron activation.

## Production bootstrap follow-up — 24 October 2026

The separately requested migration PR adds `202610240006_structured_bootstrap.sql`. On merge to `main`, the existing Production workflow applies the committed migrations, activates only OSV/CVE/KEV from **2026-09-24T00:00:00Z**, and deploys the checked commit. Existing checkpoints and historical data are retained. A pinned upstream CVE delta snapshot covers the start of the requested month before the importer switches to live updates; see [structured-source activation](structured-sources.md#activation-after-database-readiness). No production migration or import has been run as part of preparing this PR.

- [x] Configured the GitHub `production` environment for the `main` branch only and verified that `SUPABASE_DB_URL`, `SUPABASE_DB_CA_CERT`, `VERCEL_TOKEN`, `VERCEL_PROJECT_ID` and `VERCEL_TEAM_ID` are saved. Presence is verified; live database connectivity and deployment permissions still need release validation.
- [x] Created the approved Vercel token scoped to the `security-advisory` project, expiring **23 November 2026**, and saved it only in the GitHub production environment. Assign its renewal owner before expiry.
- [ ] Replace the provisional `SUPABASE_SERVICE_ROLE_KEY` and `CRON_SECRET` in Vercel Production and revoke the old Supabase server key **before merging this release PR**. Leave `VENDOR_SOURCE_IDS` empty and hosting cron disabled.
- [ ] Verify a recoverable database backup, require the migration CI check, and validate the first production release, database role isolation, source checkpoints and populated feed.
- [ ] Configure authenticated monitoring, test edge/cache controls, then enable cron and complete the 24-hour observation period.

The Production workflow is enabled; adding the credentials did not pause it. A new push to `main` or a manual dispatch will attempt production migrations and deployment. PR checks only use disposable PostgreSQL and do not receive production credentials. The earlier inspection below remains a dated record, not evidence that these launch gates have passed.

## Verification record — 24 October 2026

This is a dated snapshot of the earlier hosting inspection, not a declaration that the hosted feed is ready to launch. Database migrations are explicitly outside this setup PR: none were implemented or applied by this work. Database-role verification, live pipeline validation and the 24-hour observation period still require database readiness and hosted evidence.

Since that inspection, [PR #9](https://github.com/heist-security/security-advisory/pull/9) and [PR #11](https://github.com/heist-security/security-advisory/pull/11) have merged. Main now includes the automatic production release workflow and structured OSV/CVE/KEV ingestion. The default feed needs no model credentials or paid extraction; provider controls and model evaluation apply only to opted-in vendor feeds. This documentation rebase does not reverify hosted configuration or the outcome of production releases triggered by those merges. Follow the [structured-source activation instructions](structured-sources.md) after verifying database readiness.

### Verified repository controls

- [x] The active [Protect main ruleset](https://github.com/heist-security/security-advisory/rules/25775691) requires a pull request, one approving review, and the `validate` and `browser` checks from GitHub Actions. Deletion and force pushes are blocked; the bypass list is empty.
- [x] Secret Protection, push protection and private vulnerability reporting are enabled in repository settings.
- [x] The MIT license, branding notice and upstream-content attribution notice are present.
- [x] Both required CI jobs passed on the previously inspected PR head `29c026526da5fbcb0511eb7a1cc1f29f111985ec`: [validate](https://github.com/heist-security/security-advisory/actions/runs/40080012437) and [browser](https://github.com/heist-security/security-advisory/actions/runs/40080012476). The current PR checks and eventual release commit must be checked separately.
- [ ] Independently verify the reporting entry point using a non-maintainer account. No test vulnerability was submitted.
- [ ] Verify the new `Production / migrations` check is also required by branch protection; the earlier inspection confirmed only `validate` and `browser`.

### Dedicated database and production configuration

- [x] Created the dedicated [heist-feed Supabase project](https://supabase.com/dashboard/project/vkwijiiwtblvjmateyrs) in the Heist Pro organization after checking the project inventory for duplicates. The approved Micro instance reports Healthy in West EU (Ireland), `eu-west-1`, at the displayed additional $10/month.
- [x] Verified Data API enabled and automatic exposure of new tables disabled. The API settings show no application tables or functions. The existing Heist application database was not used or modified.
- [x] Saved the following variables in the existing Vercel project, all scoped only to Production. Secret values were stored using Vercel's non-revealable Secret type.

| Variable                    | Saved configuration                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------------ |
| `SUPABASE_URL`              | Dedicated heist-feed project URL                                                           |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server secret; replacement required before deployment                             |
| `CRON_SECRET`               | Random 32-byte secret encoded as 64 hex characters; replacement required before deployment |
| `PUBLIC_BASE_URL`           | `https://feed.heist.security`                                                              |
| `OPENAI_MODEL`              | `gpt-5.4-mini-2026-03-17`, unevaluated candidate                                           |
| `EXTRACTION_HOURLY_LIMIT`   | `60`                                                                                       |
| `PROCESS_BATCH_SIZE`        | `1`                                                                                        |
| `PROCESS_CONCURRENCY`       | `1`                                                                                        |

`SUPABASE_SERVICE_ROLE_KEY` holds a modern Supabase server secret rather than a legacy JWT. The application passes it directly to `createClient`; Supabase documents this server-side usage and its `service_role` privileges in [API keys](https://supabase.com/docs/guides/getting-started/api-keys). Live role and RPC verification is still pending.

The provisional database and cron secret values must be replaced before the first configured deployment, and the provisional Supabase secret must be revoked. This credential handoff is an unresolved launch gate. Do not copy values into documentation, PRs, logs or preview settings.

`OPENAI_API_KEY` was absent at inspection. No paid model calls or evaluation runs were made. The saved variables required a new deployment to take effect; no new production deployment was started during the hosting setup. The model and extraction-limit settings above apply only to opted-in vendor extraction. Leave `VENDOR_SOURCE_IDS` empty for the structured default; its separate `STRUCTURED_PROCESS_BATCH_SIZE` defaults to 120.

- [x] Preview environment inspection showed no project variables and no linked shared variables. Production credentials were not copied to previews.
- [ ] Provision a separate preview database before previews are expected to exercise database-backed behavior. No second paid database was created.

### Domain, deployment and edge controls

- [x] The existing Vercel GitHub integration is connected to this repository. Production branch tracking is `main`.
- [x] Confirmed `heist.security` belongs to the Heist team in Vercel and is managed in the Heist Cloudflare account. There was no existing `feed` DNS record.
- [x] Added `feed.heist.security` to the project's Production environment and created a Cloudflare CNAME: `feed` → `d6d9e956aa422a08.vercel-dns-016.com`, DNS only, TTL Auto. Vercel completed certificate generation and reports Valid Configuration. The HTTPS homepage loaded without a certificate warning.
- [x] Inspected the existing [production deployment](https://vercel.com/heist/security-advisory/FyaShG4vnTTSnrcu6rkAFt9p4H9z): Ready but Stale, from `codex/operations-launch-status` at `173e17d8990a8ed9df836482468a518bb97d42ca`. At inspection, the domain served that empty feed; this did not validate the pipeline or newly saved configuration. Recheck the current deployment after the subsequent merges.
- [x] Rechecked the published firewall rule and audit log. Version #1 contains the enabled public-feed rule.
- [ ] Verify the edge rule, cache behavior and legitimate shared-IP traffic under representative load.
- [ ] Extend or otherwise verify edge protection for the legacy `/feed` redirect introduced by PR #9; the recorded rule below does not match that path.

The published rule uses a fixed 60-second window of 120 requests per IP, shared across `/`, `/sources`, `/feed.xml` and `/api/v1/*`. Its request-path expression is `^(/|/sources/?|/feed\.xml|/api/v1/.*)$`; protected `/api/cron/*` routes are excluded. The action is HTTP 429, with no persistent action. The previously approved pricing was $0.50 per million allowed requests. No browser challenge was introduced.

### Worker scheduling, budgets and monitoring

- [x] Vercel lists `/api/cron/poll`, `/api/cron/collect` and `/api/cron/process` every minute, matching `vercel.json`. All three source routes declare `maxDuration = 300`.
- [x] Paused cron execution in the project's Cron Jobs settings. The dashboard showed Disabled and all Run buttons disabled. Keep it paused until replacement credentials, database readiness, source configuration and hosted validation are complete. Provider controls and evaluation are additional gates only for opted-in vendor extraction.
- [x] Verified an existing Vercel team spend budget with alerts at 50%, 75% and 100%. Automatic pause and webhook delivery are off. The existing team budget was not changed; alert receipt and a project-specific budget were not tested.
- [x] An unauthenticated HTTPS request to `/api/cron/health` returned `{"error":"Unauthorized"}`.
- [ ] Configure and test an external authenticated health monitor. No monitoring destination is configured by this work. Vercel's project alert screen requires Observability Plus; no additional paid feature was enabled.

For the health monitor, use GET `https://feed.heist.security/api/cron/health` every 5 minutes with `Authorization: Bearer <replacement CRON_SECRET>` stored in the monitor's secret store, never in the URL. Expect HTTP 200 and `status: ok`; alert on 401, 503, timeout or TLS failure. Verify notification delivery and recovery after the separate migration work and configured deployment. This is a proposed monitor configuration, not evidence of an active monitor.

### Optional vendor extraction and remaining release work

This model configuration is relevant only when `VENDOR_SOURCE_IDS` selects vendor feeds. It is not a prerequisite for the structured default.

The pinned candidate `gpt-5.4-mini-2026-03-17` supports the Responses API and structured outputs according to the [model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini). It is a candidate for evaluation, not a validated production model. No quality, latency, token-use or currency-cost results exist from this setup.

At inspection, the signed-in provider account had no dedicated feed project configured. The inspected project's Limits screen had no project spend limit and offered an explicit **Enforce a hard limit** option. A provider spending amount and funding decision are required before enabling vendor extraction. Use a dedicated provider project/key, restrict model access, set the agreed currency limit with enforcement and alerts, and verify the control. [Provider documentation](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform) distinguishes alerts from enforcement and warns that enforcement can lag tracked spend. No provider budget, funding or credentials were changed.

The saved vendor extraction limit is 60 attempts per UTC hour, at most 1,440 attempts over 24 complete hourly windows, including failures. It depends on the migration-provided PostgreSQL claim function, applies across overlapping workers, and is not a currency cap. Zero is not a valid configured limit. Leaving `VENDOR_SOURCE_IDS` empty or the provider key unset disables paid extraction while permitting structured processing once the other launch gates are met.

Complete these remaining steps in order:

1. Replace the provisional production secrets and revoke the provisional Supabase server key. Keep all production credentials out of Preview.
2. Verify the protected production environment and release credentials described below, inspect the latest Production workflow outcome and reconcile database readiness through the separately managed migration process. Then verify the real REST API rejects anon/authenticated access and allows the required server operations. Merged workflow code alone is not evidence that migrations ran.
3. Verify the bootstrap migration has registered OSV/CVE/KEV with the approved initial timestamp and CVE snapshot, preserving any existing checkpoints. Keep `VENDOR_SOURCE_IDS` empty. Use `npm run sources:configure` only for subsequent reviewed selection changes; it does not apply migrations or import the full historical databases.
4. **Only for opted-in vendor extraction:** agree the provider budget/funding, create the dedicated provider project/key, enforce its limits and evaluate the pinned candidate. Follow [docs/evaluation.md](evaluation.md): at least 100 representative, manually labeled real announcements, including known negatives, multiple products/fixed versions, withdrawals, short and non-English notices, ambiguous severity and prompt-injection cases. Retain source URLs, acquisition dates and permissions. Synthetic fixtures are only smoke tests.
5. **Only for opted-in vendor extraction:** after spending approval, run the paid launch evaluation with `--allow-paid --fixtures=/absolute/path/cases.json --launch`. Review titles/summaries, false positives/negatives and product-version associations; record actual provider token usage and cost separately. No such results are claimed here.
6. Verify the reviewed `main` release through the Production workflow with replacement credentials. With cron paused, run authenticated poll, collect and process; verify source checkpoints, health and populated RSS/JSON/UI behavior, then configure and test the monitor.
7. Re-enable cron only when the applicable preceding gates are met. Drain initial backlogs, test corrections and filters, perform cache/rate-limit load checks, and observe scheduled jobs, failures and source lag for at least 24 hours. No observation-period evidence has been recorded by this setup work.

The deployment sequence below describes the eventual release process. It does not authorize migration work as part of this hosting-status PR.

## Automatic production deployment

The [Production workflow](../.github/workflows/production.yml) runs on pushes to `main`. It runs the Check and Browser workflows plus a disposable PostgreSQL migration check, then applies pending migrations and deploys the **same commit** to Vercel. Pull requests run checks without production secrets. Manual retries are available through **Actions → Production → Run workflow**, selecting `main`.

The workflow serializes production releases and does not cancel an in-progress migration when another commit arrives. Superseded runs skip deployment. GitHub can replace a pending run with a newer one; that newer run applies all outstanding migration files. Vercel's automatic Git deployment is disabled for `main` in `vercel.json`, so it cannot deploy ahead of migrations. Preview branches still use the Vercel integration.

The bundled release is restricted to `heist-security/security-advisory`. Fork operators must update the repository condition in `production.yml` and the repository checks and `gitSource` in `.github/scripts/release.mjs` to their own repository, then configure their own protected environment and credentials.

### One-time setup before merging

These settings require an administrator; committing the workflow does not create them.

- [x] Dedicated Supabase production project, Vercel repository connection, `main` production branch and GitHub App access were verified in the dated setup record above. Reuse those projects.
- [x] In GitHub **Settings → Environments**, configured `production` with **Selected branches and tags**, allowing the **branch** `main` only. No tags or pull-request refs are allowed. A required deployment reviewer is optional if reviewed merges should deploy automatically.
- [x] Added the following settings to that environment. Production credentials are not placed in repository-wide secrets, source files, PR workflows or preview deployments. Successful use still needs release validation.

| Kind     | Name                  | Value                                                                                                                                                                                                                                                 |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret   | `SUPABASE_DB_URL`     | PostgreSQL connection URL with a database migration owner's credentials and `sslmode=verify-full`. Percent-encode the password. Use the direct connection when reachable, or the IPv4 session pooler on port 5432; do not use the transaction pooler. |
| Secret   | `SUPABASE_DB_CA_CERT` | PEM root certificate downloaded from Supabase Database settings → SSL configuration. The workflow installs this temporarily and verifies the server hostname.                                                                                         |
| Secret   | `VERCEL_TOKEN`        | Deployment-capable token scoped to the team hosting this project, with an expiry and rotation owner.                                                                                                                                                  |
| Variable | `VERCEL_PROJECT_ID`   | Existing project's `prj_...` ID from Vercel project settings.                                                                                                                                                                                         |
| Variable | `VERCEL_TEAM_ID`      | Hosting team's `team_...` ID from Vercel team settings.                                                                                                                                                                                               |

`GITHUB_TOKEN` is provided automatically with read-only repository access. The migration connection is a PostgreSQL credential, not the Supabase service-role API key; no Supabase account access token is needed. Its role must own or be able to change the objects in these migrations, including grants and functions. Keep it exclusive to the release job.

- [ ] Configure the application secrets and `PUBLIC_BASE_URL` in Vercel's **Production** environment. Preview deployments must use separate database credentials and no production cron/model secret. Production application secrets remain in Vercel.
- [ ] After database readiness, reconcile structured-source configuration as described in [structured ingestion](structured-sources.md). Leave vendor selection empty unless its separate model and spending gates are complete.
- [ ] Protect `main` with reviewed pull requests, force-push/deletion protection, and required `Check / validate`, `Browser / browser` and `Production / migrations` checks. Review changes to `.github/`, `vercel.json`, dependencies and `supabase/` as production code.
- [ ] If SQL was previously applied through the Supabase dashboard, reconcile the live schema with the committed migrations and the `supabase_migrations.schema_migrations` history **before** enabling automation. After verifying an individual migration was fully applied, use `supabase migration repair --status applied <version>` with an authorized local connection. Never mark a partially applied or unverified migration as applied. The workflow deliberately does not repair history or reset the database.
- [ ] Verify a recoverable database backup and the restore procedure. Keep schema changes compatible with the currently running app: add first, deploy the new app, and remove obsolete columns/functions in a later reviewed release.
- [ ] Confirm the existing Vercel auto-deployment, deploy hooks, dashboard redeployments or any other integration cannot bypass this release sequence. Do not use a deploy hook that deploys the latest branch tip, which may differ from the checked commit.

The first merge switches production deployment to Actions. Missing settings fail the release; the previous deployment remains serving. Configure these settings before merging if uninterrupted releases are required. Preview deployments do not run database migrations.

### Failures and retries

Migrations run with the pinned Supabase CLI using `db push`. Already recorded migrations are skipped. The workflow never runs `db reset`, seeds, automatic down migrations or `--include-all` against production. Migration failures stop the deployment. Earlier migration files in the same run may already have committed; inspect the database and history before retrying.

The release job does not install application dependencies or execute npm scripts. It sends Vercel an exact Git commit after migration success, then waits for readiness and domain assignment. HTTP redirects are refused and raw provider/database diagnostics are withheld from public Actions logs. Diagnose failures using private Supabase/Vercel logs or an authorized local CLI session; never paste credentials or production data into an issue.

If the Vercel build fails, the database may already be upgraded while the previous application keeps serving. Fix forward with a reviewed migration or application change. A code revert does not reverse a database migration. Retry the latest `main` through **Run workflow** after resolving the failure.

The job requests cancellation if a remote deployment fails or times out. A manual workflow cancellation, runner loss or ambiguous API failure can leave a Vercel deployment running; inspect and, if necessary, cancel it in Vercel before retrying. Only one system should write production migrations.

## Deployment verification

1. Confirm the Production workflow succeeds, including migrations and Vercel readiness.
2. Reconcile the configured sources, then run authenticated poll, collect and process. Inspect /api/cron/health with the cron bearer token.
3. Confirm real events appear through JSON, RSS and the homepage (including the /feed redirect), then exercise search, technology/CVE/type filters and a correction.
4. Verify hosting controls and structured-import behavior before announcing the service. Verify model extraction quality and spend for any opted-in vendor feeds.

## Capacity and monitoring

Structured polling stages up to 2,000 unique OSV/CVE records per source invocation and a bounded complete KEV snapshot, in batches of 500. Checkpoints advance only after successful staging. Structured processing defaults to 120 documents per invocation without model calls or paid-attempt reservations. See [structured ingestion](structured-sources.md) for cursor recovery and transport limits.

collect defaults to 60 entries per invocation, four concurrent fetches. For opted-in vendor feeds, poll stages the complete fetched feed in batches of 500 and process defaults to 24 documents, four concurrent model calls; the staged production overrides above are more conservative. Staging is idempotent. Failed partial vendor polls clear validators and safely restage on the next run. Inline vendor feeds honor conditional HTTP; article feeds requeue completed entries for article-change checks.

Vendor feed bodies are capped per source (maximum 10 MB); documents are capped at 50,000 characters. A vendor feed above 20,000 entries fails explicitly and needs a paginated adapter. The byte cap also bounds XML parser input. Watch collection backlog when adding high-volume sources. Polling cannot recover an item removed by a publisher before it was observed.

The three protected worker endpoints return 503 with counts on partial failures; the next scheduled run handles retryable work. Logs contain operation names, counts and known failure categories, not provider response bodies or source text.

The protected health response includes source failures/lag, collection and extraction queue counts, oldest pending ages, failed counts, hourly model attempts and latest publication time. Monitor it externally every few minutes. 503 means unavailable/degraded. A large intentional first backfill may exceed MAX_QUEUE_AGE_SECONDS; inspect the backlog rather than disabling monitoring.

EXTRACTION_HOURLY_LIMIT is enforced in PostgreSQL across overlapping vendor workers. Every claim through the vendor claim function reserves an attempt, including failed calls; the limit resets at the UTC hour boundary. Dedicated structured claims bypass that budget. Configure provider currency spending controls separately before opting into vendor extraction. A model-name change requires re-evaluation.

To retry after fixing configuration, scope updates to affected IDs and reset status to pending, attempts to 0, available_at to now(), and clear lease fields in feed_entries or documents. Do not reset healthy in-flight jobs.

Define a retention policy before scale. Documents and events retain history; feed_entries retains the latest observed item for each source URL. Avoid deleting documents referenced by events/advisories.

## Source changes

Use `npm run sources:configure` to preview the core sources and explicit `VENDOR_SOURCE_IDS` selections; `--apply` reconciles existing source rows after database readiness. It preserves history and checkpoints and disables unselected sources. Choose an initial timestamp deliberately; this is not a full historical import.

For changes to the historical vendor catalog, npm run sources:verify updates the proposed registry. Generate a new, uniquely named migration in a separately reviewed change:

    npm run sources:build -- --migration=202611010001_registry_update.sql

Applied migrations are immutable. The generator disables removed catalog IDs and preserves retained sources' operator enable/disable choices. Review that migration before applying it, then reconcile source configuration again. Publisher outages should usually disable sources temporarily instead of deleting history. Reconciliation deliberately re-enables selected sources, so review operator pauses before running it.

## Hosting controls requiring administrator configuration

These are not enabled by committing repository files:

- GitHub: protect main with pull requests, one approving review, required Check / validate, Browser / browser and Production / migrations checks, and force-push/deletion protection.
- GitHub: enable secret scanning/push protection and private vulnerability reporting. Confirm a test reporter can see Security → Report a vulnerability. Do not publish a real test vulnerability.
- Vercel: create edge rate limits covering /, /feed, /sources, /feed.xml and /api/v1/*. Start with a documented per-IP budget appropriate to expected polling, then adjust using real traffic. Exempt protected scheduled endpoints from public rules; they still require bearer authentication.
- Vercel: verify cron frequency/timeout support and monitoring. Configure budget alerts and production domain/TLS.
- Supabase: verify anon/authenticated roles cannot access tables, queues or RPCs through the real REST API. Verify service-role operations work.
- Self hosting: enforce HTTPS and an egress policy denying private-network/metadata destinations. Origin allowlists alone are not DNS pinning.

## Release gate

- [ ] Code checks, migration tests and browser tests pass on the release commit.
- [ ] Manually inspect desktop/mobile screenshots and real populated pages.
- [ ] Verify source configuration, checkpoints and native affected-version data for the structured default; exercise updates and withdrawals.
- [ ] If vendor extraction is enabled, evaluate the selected model on at least 100 representative, manually labeled real announcements, including irrelevant releases, multiple products, corrections, non-English sources and hostile instructions.
- [ ] If vendor extraction is enabled, record precision, recall, field correctness, failure rate, token usage and cost, and verify approved spending controls.
- [ ] Exercise a live Supabase → poll → collect → process → publication → RSS/JSON/UI flow and correction; include the model path only for opted-in vendors.
- [ ] Drain initial backlogs; observe scheduled jobs, failures and source lag for at least a day.
- [ ] Test cache behavior and edge rate controls under representative load.
- [ ] Confirm license, attribution, private reporting and repository protection settings.

CI is not evidence that hosted controls or live model quality passed these checks.

### Severity and linked patch rollout

The event-priority migration adds database-side severity, Important updates and Fix available subscription indexes. It snapshots linked CVE context and backfills existing records without queueing paid extraction or replaying historical notifications. The repaired release commits schema changes first, then takes the publication lock for each bounded backfill batch; review the backfill and normal migration/deployment checks before merging.

New model responses extract explicit `fixed_cves` evidence; provider severity remains unchanged. Historical linking only accepts verbatim opening remediation headings. Model relationship quality is not established by deterministic validation alone: evaluate relevant, unrelated, negated and cross-product examples before claiming extraction precision or coverage. No live paid evaluation was performed for this change.

After deployment, verify `/api/v1/events?source=ruby&severity=critical&fix=1` includes the original GitLab-related fix with attributed GitLab ratings, and `/feed.xml?important=1` includes unrated security fixes. Compare website/RSS/JSON and check `context_update` revisions on a controlled fixture for late ratings, downgrades and KEV removals. Existing consumers adopting these new filters must backfill from a fresh cursor. Historical severity-routing keys intentionally deliver subsequent corrections even after their priority falls.

## Recovery of the failed priority release (25 October 2026)

Production run 40188780714 failed during migration 008 before Vercel deployment. Its old logs suppress the underlying database diagnostic, so the exact hosted SQL error is unconfirmed. Public endpoints subsequently recovered. A full-history priority backfill was embedded in the same transaction as ALTER TABLE; this retains an ACCESS EXCLUSIVE lock and can block public reads for the duration.

The repair removes historical DML from the failed 008 and adds 009 with a private, resumable 100-row backfill. Schema lock waits are capped at five seconds and individual schema statements at 30 seconds. The release runs batches in separate transactions after schema commit, with a 30-second statement deadline per batch, and only deploys when the backfill reports complete. A failed/interrupted batch rolls back its checkpoint; retry resumes committed batches. No event IDs or paid extraction jobs are created by this backfill. Projects where the original 008 completed skip that file normally; 009 preserves existing priority snapshots and subscription keys. Do not delete or rewrite migration-history rows.

Before retrying production, inspect the dedicated heist-feed project's migration history and active sessions. Confirm no old migration remains active. This PR does not itself cancel sessions, rerun jobs, or alter production. The repair is an explicit amendment of the failed 008; other historical files remain unchanged. CI now exercises an upgrade with 2,000 existing events and verifies completion, idempotence and no historical event replay. Release logs show only allowlisted failure categories, never raw SQL diagnostics or credentials.

After the reviewed repair is merged, verify the Production run, nonempty RSS/JSON/UI, priority filter results and subsequent publisher events. If the release stops during backfill, fix the reported category and retry without resetting the checkpoint. Confirm the GitLab-related Ruby patch has attributed CVE priority.

The combined #20/#19 release (run 40199583028) passed schema migration but stopped at the backfill client on 25 October at 13:55 UTC. The first runner supplied the entire connection URI in `PGDATABASE`; libpq treats this environment default as a database name, so it did not connect to the intended host. The follow-up passes host, port, database and user separately, keeps the decoded password in a temporary mode-0600 password file, and retains verified TLS. The password file and CA file are removed on success or failure. No database migrations or checkpoint changes are required for this connection fix.

Migration CI now exercises the actual release script's `psql` connection and batching against its disposable populated PostgreSQL service, including the old connection failure and an idempotent retry. Only that local fixture disables TLS; production still requires `verify-full`. Public availability of the previous deployment does not establish completion of this release or its priority backfill.

## Multiple event types

Apply `202610250015_event_type_filters.sql` before deploying the type multi-select UI. It updates grouped feed queries to accept comma-separated type unions while preserving single-type subscriptions, cursor pagination, and correction routing. The production workflow applies it before deployment. No data backfill is needed.
