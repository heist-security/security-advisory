# Operations and launch checks

## Verification record — 24 October 2026

This is a dated snapshot, not a declaration that the hosted feed is ready to launch. Database migrations are explicitly outside this setup PR: none were implemented or applied. Database-role verification, live pipeline validation and the 24-hour observation period remain blocked on the separate migration work.

### Verified repository controls

- [x] The active [Protect main ruleset](https://github.com/heist-security/security-advisory/rules/25775691) requires a pull request, one approving review, and the `validate` and `browser` checks from GitHub Actions. Deletion and force pushes are blocked; the bypass list is empty.
- [x] Secret Protection, push protection and private vulnerability reporting are enabled in repository settings.
- [x] The MIT license, branding notice and upstream-content attribution notice are present.
- [x] Both required CI jobs passed on the previously inspected PR head `29c026526da5fbcb0511eb7a1cc1f29f111985ec`: [validate](https://github.com/heist-security/security-advisory/actions/runs/40080012437) and [browser](https://github.com/heist-security/security-advisory/actions/runs/40080012476). The current PR checks and eventual release commit must be checked separately.
- [ ] Independently verify the reporting entry point using a non-maintainer account. No test vulnerability was submitted.

PR #10 was found open and ready for review, and was returned to draft while these launch gates remain open. No PR was merged.

### Dedicated database and production configuration

- [x] Created the dedicated [heist-feed Supabase project](https://supabase.com/dashboard/project/vkwijiiwtblvjmateyrs) in the Heist Pro organization after checking the project inventory for duplicates. The approved Micro instance reports Healthy in West EU (Ireland), `eu-west-1`, at the displayed additional $10/month.
- [x] Verified Data API enabled and automatic exposure of new tables disabled. The API settings show no application tables or functions. The existing Heist application database was not used or modified.
- [x] Saved the following variables in the existing Vercel project, all scoped only to Production. Secret values were stored using Vercel's non-revealable Secret type.

| Variable | Saved configuration |
| --- | --- |
| `SUPABASE_URL` | Dedicated heist-feed project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase server secret; replacement required before deployment |
| `CRON_SECRET` | Random 32-byte secret encoded as 64 hex characters; replacement required before deployment |
| `PUBLIC_BASE_URL` | `https://feed.heist.security` |
| `OPENAI_MODEL` | `gpt-5.4-mini-2026-03-17`, unevaluated candidate |
| `EXTRACTION_HOURLY_LIMIT` | `60` |
| `PROCESS_BATCH_SIZE` | `1` |
| `PROCESS_CONCURRENCY` | `1` |

`SUPABASE_SERVICE_ROLE_KEY` holds a modern Supabase server secret rather than a legacy JWT. The application passes it directly to `createClient`; Supabase documents this server-side usage and its `service_role` privileges in [API keys](https://supabase.com/docs/guides/getting-started/api-keys). Live role and RPC verification is still pending.

The provisional database and cron secret values must be replaced before the first configured deployment, and the provisional Supabase secret must be revoked. This credential handoff is an unresolved launch gate. Do not copy values into documentation, PRs, logs or preview settings.

`OPENAI_API_KEY` is absent. No paid model calls or evaluation runs were made. Vercel explicitly requires a new deployment for the saved variables to take effect; no new production deployment was started during this continuation.

- [x] Preview environment inspection showed no project variables and no linked shared variables. Production credentials were not copied to previews.
- [ ] Provision a separate preview database before previews are expected to exercise database-backed behavior. No second paid database was created.

### Domain, deployment and edge controls

- [x] The existing Vercel GitHub integration is connected to this repository. Production branch tracking is `main`.
- [x] Confirmed `heist.security` belongs to the Heist team in Vercel and is managed in the Heist Cloudflare account. There was no existing `feed` DNS record.
- [x] Added `feed.heist.security` to the project's Production environment and created a Cloudflare CNAME: `feed` → `d6d9e956aa422a08.vercel-dns-016.com`, DNS only, TTL Auto. Vercel completed certificate generation and reports Valid Configuration. The HTTPS homepage loaded without a certificate warning.
- [x] Inspected the existing [production deployment](https://vercel.com/heist/security-advisory/FyaShG4vnTTSnrcu6rkAFt9p4H9z): Ready but Stale, from `codex/operations-launch-status` at `173e17d8990a8ed9df836482468a518bb97d42ca`. The domain currently serves that existing empty feed, not a validated pipeline or the newly saved configuration.
- [x] Rechecked the published firewall rule and audit log. Version #1 contains the enabled public-feed rule.
- [ ] Verify the edge rule, cache behavior and legitimate shared-IP traffic under representative load.

The published rule uses a fixed 60-second window of 120 requests per IP, shared across `/`, `/sources`, `/feed.xml` and `/api/v1/*`. Its request-path expression is `^(/|/sources/?|/feed\.xml|/api/v1/.*)$`; protected `/api/cron/*` routes are excluded. The action is HTTP 429, with no persistent action. The previously approved pricing was $0.50 per million allowed requests. No browser challenge was introduced.

### Worker scheduling, budgets and monitoring

- [x] Vercel lists `/api/cron/poll`, `/api/cron/collect` and `/api/cron/process` every minute, matching `vercel.json`. All three source routes declare `maxDuration = 300`.
- [x] Paused cron execution in the project's Cron Jobs settings. The dashboard shows Disabled and all Run buttons disabled. Keep it paused until credentials, migrations, provider controls and evaluation are ready.
- [x] Verified an existing Vercel team spend budget with alerts at 50%, 75% and 100%. Automatic pause and webhook delivery are off. The existing team budget was not changed; alert receipt and a project-specific budget were not tested.
- [x] An unauthenticated HTTPS request to `/api/cron/health` returned `{"error":"Unauthorized"}`.
- [ ] Configure and test an external authenticated health monitor. No monitoring destination is configured by this work. Vercel's project alert screen requires Observability Plus; no additional paid feature was enabled.

For the health monitor, use GET `https://feed.heist.security/api/cron/health` every 5 minutes with `Authorization: Bearer <replacement CRON_SECRET>` stored in the monitor's secret store, never in the URL. Expect HTTP 200 and `status: ok`; alert on 401, 503, timeout or TLS failure. Verify notification delivery and recovery after the separate migration work and configured deployment. This is a proposed monitor configuration, not evidence of an active monitor.

### Extraction candidate and remaining release work

The pinned candidate `gpt-5.4-mini-2026-03-17` supports the Responses API and structured outputs according to the [model documentation](https://developers.openai.com/api/docs/models/gpt-5.4-mini). It is a candidate for evaluation, not a validated production model. No quality, latency, token-use or currency-cost results exist from this setup.

The signed-in provider account has no dedicated feed project configured. The inspected project's Limits screen has no project spend limit and offers an explicit **Enforce a hard limit** option. A provider spending amount and funding decision are still required. Use a dedicated provider project/key, restrict model access, set the agreed currency limit with enforcement and alerts, and verify the control. [Provider documentation](https://help.openai.com/en/articles/9186755-managing-projects-in-the-api-platform) distinguishes alerts from enforcement and warns that enforcement can lag tracked spend. No provider budget, funding or credentials were changed.

The saved extraction limit is 60 attempts per UTC hour, at most 1,440 attempts over 24 complete hourly windows, including failures. It depends on the migration-provided PostgreSQL claim function, applies across overlapping workers, and is not a currency cap. Zero is not a valid configured limit in the current code. Leaving the provider key unset and cron execution disabled keeps paid extraction inactive.

Complete these remaining steps in order:

1. Replace the provisional production secrets and revoke the provisional Supabase server key. Keep all production credentials out of Preview.
2. Complete the separately reviewed migration work. Then verify the real REST API rejects anon/authenticated access and allows the required server operations.
3. Agree the provider budget/funding, create the dedicated provider project/key and enforce its limits. Evaluate the pinned candidate before approving it for publication.
4. Follow [docs/evaluation.md](evaluation.md): use at least 100 representative, manually labeled real announcements with known negatives, multiple products/fixed versions, withdrawals, short and non-English notices, ambiguous severity and prompt-injection cases. Retain source URLs, acquisition dates and permissions with the reviewed corpus. Synthetic fixtures are only smoke tests.
5. Run the paid launch evaluation only after spending is approved, with `--allow-paid --fixtures=/absolute/path/cases.json --launch`. Review titles/summaries, false positives/negatives and product-version associations; record actual provider token usage and cost separately. No such results are claimed here.
6. Deploy the reviewed release from `main` with the replacement production credentials, verify authenticated health and populated RSS/JSON/UI behavior, and configure the monitor.
7. Re-enable cron only when the preceding gates are met. Drain initial backlogs, test corrections and filters, perform cache/rate-limit load checks, and observe scheduled jobs, failures and source lag for at least 24 hours. The observation period has not started.

The deployment sequence below describes the eventual release process. It does not authorize migration work as part of this hosting-status PR.

## Automatic production deployment

The [Production workflow](../.github/workflows/production.yml) runs on pushes to `main`. It runs the Check and Browser workflows plus a disposable PostgreSQL migration check, then applies pending migrations and deploys the **same commit** to Vercel. Pull requests run checks without production secrets. Manual retries are available through **Actions → Production → Run workflow**, selecting `main`.

The workflow serializes production releases and does not cancel an in-progress migration when another commit arrives. Superseded runs skip deployment. GitHub can replace a pending run with a newer one; that newer run applies all outstanding migration files. Vercel's automatic Git deployment is disabled for `main` in `vercel.json`, so it cannot deploy ahead of migrations. Preview branches still use the Vercel integration.

The bundled release is restricted to `heist-security/security-advisory`. Fork operators must update the repository condition in `production.yml` and the repository checks and `gitSource` in `.github/scripts/release.mjs` to their own repository, then configure their own protected environment and credentials.

### One-time setup before merging

These settings require an administrator; committing the workflow does not create them.

- [ ] Create a dedicated Supabase production project and connect the Vercel project to this repository, with `main` as its production branch. The Vercel GitHub App must have repository access.
- [ ] In GitHub **Settings → Environments**, create `production`. Under deployment branches/tags, select **Selected branches and tags** and allow the **branch** `main` only. Do not add tags or pull-request refs. A required deployment reviewer is optional if reviewed merges should deploy automatically.
- [ ] Add the following settings to that environment. Do not place production credentials in repository-wide secrets, source files, PR workflows or preview deployments.

| Kind     | Name                  | Value                                                                                                                                                                                                                                                 |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Secret   | `SUPABASE_DB_URL`     | PostgreSQL connection URL with a database migration owner's credentials and `sslmode=verify-full`. Percent-encode the password. Use the direct connection when reachable, or the IPv4 session pooler on port 5432; do not use the transaction pooler. |
| Secret   | `SUPABASE_DB_CA_CERT` | PEM root certificate downloaded from Supabase Database settings → SSL configuration. The workflow installs this temporarily and verifies the server hostname.                                                                                         |
| Secret   | `VERCEL_TOKEN`        | Deployment-capable token scoped to the team hosting this project, with an expiry and rotation owner.                                                                                                                                                  |
| Variable | `VERCEL_PROJECT_ID`   | Existing project's `prj_...` ID from Vercel project settings.                                                                                                                                                                                         |
| Variable | `VERCEL_TEAM_ID`      | Hosting team's `team_...` ID from Vercel team settings.                                                                                                                                                                                               |

`GITHUB_TOKEN` is provided automatically with read-only repository access. The migration connection is a PostgreSQL credential, not the Supabase service-role API key; no Supabase account access token is needed. Its role must own or be able to change the objects in these migrations, including grants and functions. Keep it exclusive to the release job.

- [ ] Configure the application secrets and `PUBLIC_BASE_URL` in Vercel's **Production** environment. Preview deployments must use separate database credentials and no production cron/model secret. Production application secrets remain in Vercel.
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
2. Run poll, collect and process. Inspect /api/cron/health with the cron bearer token.
3. Confirm real events appear through JSON, RSS and /feed, then exercise search, technology/CVE/type filters and a correction.
4. Verify hosting controls, extraction quality and spend before announcing the service.

## Capacity and monitoring

poll stages the complete fetched feed in batches of 500. collect defaults to 60 entries per invocation, four concurrent fetches. process defaults to 24 documents, four concurrent model calls. Staging is idempotent. Failed partial polls clear validators and safely restage on the next run. Inline feeds honor conditional HTTP; article feeds requeue completed entries for article-change checks.

Feed bodies are capped per source (maximum 10 MB); documents are capped at 50,000 characters. A feed above 20,000 entries fails explicitly and needs a paginated adapter. The byte cap also bounds XML parser input. Watch collection backlog when adding high-volume sources. Polling cannot recover an item removed by a publisher before it was observed.

The three protected worker endpoints return 503 with counts on partial failures; the next scheduled run handles retryable work. Logs contain operation names, counts and known failure categories, not provider response bodies or source text.

The protected health response includes source failures/lag, collection and extraction queue counts, oldest pending ages, failed counts, hourly model attempts and latest publication time. Monitor it externally every few minutes. 503 means unavailable/degraded. A large intentional first backfill may exceed MAX_QUEUE_AGE_SECONDS; inspect the backlog rather than disabling monitoring.

EXTRACTION_HOURLY_LIMIT is enforced in PostgreSQL across all overlapping workers. Every claimed extraction reserves an attempt, including failed calls; the limit resets at the UTC hour boundary. Configure provider currency spending controls separately. A model-name change requires re-evaluation.

To retry after fixing configuration, scope updates to affected IDs and reset status to pending, attempts to 0, available_at to now(), and clear lease fields in feed_entries or documents. Do not reset healthy in-flight jobs.

Define a retention policy before scale. Documents and events retain history; feed_entries retains the latest observed item for each source URL. Avoid deleting documents referenced by events/advisories.

## Source changes

npm run sources:verify updates the proposed registry. Generate a new, uniquely named migration:

    npm run sources:build -- --migration=202611010001_registry_update.sql

Applied migrations are immutable. The generator disables removed catalog IDs and preserves retained sources' operator enable/disable choices. Review that migration before applying it. Publisher outages should usually disable sources temporarily instead of deleting history.

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
- [ ] Evaluate the selected model on at least 100 representative, manually labeled real announcements, including irrelevant releases, multiple products, corrections, non-English sources and hostile instructions.
- [ ] Record precision, recall, field correctness, failure rate, token usage and cost.
- [ ] Exercise a live Supabase → collect → model → publication → RSS/JSON flow and correction.
- [ ] Drain initial backlogs; observe scheduled jobs, failures and source lag for at least a day.
- [ ] Test cache behavior and edge rate controls under representative load.
- [ ] Confirm license, attribution, private reporting and repository protection settings.

CI is not evidence that hosted controls or live model quality passed these checks.
