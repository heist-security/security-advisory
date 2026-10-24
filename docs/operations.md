# Operations and launch checks

## Verification record — 24 October 2026

This is a dated snapshot, not a declaration that the hosted feed is ready to launch.

- [x] Code and browser CI passed on `4b21f9a4765ffbcfefd4107fc630918a9ee8568c`: [Check](https://github.com/heist-security/security-advisory/actions/runs/40077692870) and [Browser](https://github.com/heist-security/security-advisory/actions/runs/40077692884). Recheck the eventual release commit.
- [x] The active [Protect main ruleset](https://github.com/heist-security/security-advisory/rules/25775691) requires a pull request, one approving review, and the `validate` and `browser` checks from GitHub Actions. Deletion and force pushes are blocked; the bypass list is empty.
- [x] GitHub Secret Protection and push protection are enabled.
- [x] Private vulnerability reporting is enabled and visible as enabled on the repository security overview.
- [x] The MIT license, branding notice and upstream-content attribution notice are present.
- [ ] Verify the reporting entry point using a separate non-maintainer account. Enabling the setting alone does not complete this check.
- [x] The existing Vercel GitHub installation can access this repository; the existing-repository import is available.
- [x] The `security-advisory` Vercel project is connected to this repository in the Heist team. No initial deployment has been started.
- [ ] Provision the dedicated production database, configure production credentials and deploy, then complete the live checks below.
- [ ] Evaluate a reviewed real-announcement corpus and observe the deployed pipeline for at least 24 hours.

### Pending edge rate limit

The proposed initial budget is 120 requests per minute per IP, shared across `/`, `/sources`, `/feed.xml` and `/api/v1/*`. The request-path expression is `^(/|/sources/?|/feed\\.xml|/api/v1/.*)# Operations and launch checks

## Verification record — 24 October 2026

This is a dated snapshot, not a declaration that the hosted feed is ready to launch.

- [x] Code and browser CI passed on `4b21f9a4765ffbcfefd4107fc630918a9ee8568c`: [Check](https://github.com/heist-security/security-advisory/actions/runs/40077692870) and [Browser](https://github.com/heist-security/security-advisory/actions/runs/40077692884). Recheck the eventual release commit.
- [x] The active [Protect main ruleset](https://github.com/heist-security/security-advisory/rules/25775691) requires a pull request, one approving review, and the `validate` and `browser` checks from GitHub Actions. Deletion and force pushes are blocked; the bypass list is empty.
- [x] GitHub Secret Protection and push protection are enabled.
- [x] Private vulnerability reporting is enabled and visible as enabled on the repository security overview.
- [x] The MIT license, branding notice and upstream-content attribution notice are present.
- [ ] Verify the reporting entry point using a separate non-maintainer account. Enabling the setting alone does not complete this check.
- [x] The existing Vercel GitHub installation can access this repository; the existing-repository import is available.
- [x] The `security-advisory` Vercel project is connected to this repository in the Heist team. No initial deployment has been started.
- [ ] Provision the dedicated production database, configure production credentials and deploy, then complete the live checks below.
- [ ] Evaluate a reviewed real-announcement corpus and observe the deployed pipeline for at least 24 hours.

; protected `/api/cron/*` routes are excluded. Use a rate-limit response rather than a browser challenge so RSS and API clients can handle it. Vercel displayed $0.50 per million allowed requests and no charge for blocked requests; activation and representative-load validation are still pending. Revisit the budget after observing legitimate polling and shared-IP traffic.

### Next deployment steps

1. Create a dedicated Supabase project; do not apply these migrations to the existing Heist application database. Keep the Data API enabled and disable automatic exposure of new tables. Review all migrations before applying them in order.
2. Grant the existing Vercel GitHub installation access to this repository only, then import the existing repository into the Heist Vercel team. Do not create a duplicate repository using the public-repository clone flow.
3. Configure production-only database, model and cron credentials. Use a separate database for previews; never copy production credentials into preview environments.
4. Select and pin the extraction model, set provider spending controls and a conservative initial extraction-attempt limit, then run the reviewed evaluation corpus.
5. Configure the production domain, TLS, edge rate controls and authenticated health monitoring before exercising the live pipeline and starting the 24-hour observation window.

Do not mark the release gate complete based on this record. Hosting controls, live database role checks, populated-page inspection, extraction quality, cost, cache/load testing and the observation window still require evidence.

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
