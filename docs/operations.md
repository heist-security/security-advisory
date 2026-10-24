# Operations and launch checks

## Deployment order

1. Apply migrations in order, including 202610240004_unified_feed.sql and 202610240005_feed_search.sql, to a dedicated Supabase project.
2. Deploy the application with server-only production keys. Preview deployments use a separate database and no production cron/model secret.
3. Run poll, collect and process. Inspect /api/cron/health with the cron bearer token.
4. Confirm real events appear through JSON, RSS and the homepage, then exercise technology/CVE/type filters and a correction.
5. Verify hosting controls, extraction quality and spend before announcing the service.

Do not run production database migrations from untrusted pull-request workflows.

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

- GitHub: protect main with pull requests, one approving review, required Check / validate and Browser / browser checks, and force-push/deletion protection.
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
