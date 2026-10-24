# Heist Feed

**One open feed for security advisories, patches and mitigations.**

Heist Feed gathers publisher announcements and upstream release notes, extracts security-relevant changes, and publishes them through one RSS feed and one JSON API. Subscribe to everything, or filter the same stream by technology, event type, CVE or source.

It catches fixes that matter even when no new CVE is assigned. Every event links to its source; product and version facts include supporting quotations.

**Status: alpha.** The catalog contains 374 streams: 22 dedicated advisory streams, 26 mixed announcement streams and 326 release-note streams. These are retrieval-checked sources, not 374 comprehensive vulnerability databases. See [coverage](docs/source-coverage.md). Production extraction accuracy, cost and deployment checks must be completed before a hosted launch.

## Browse the visual feed

The homepage `/` displays the events and filters directly. Existing `/feed` links redirect to the homepage with their filters intact. Search announcements, filter by type, technology, CVE or source, and expand each event to inspect version details and supporting quotations. URLs preserve the current view, and its RSS/JSON links use the same filters. No account is required.

Search requires migration `202610240005_feed_search.sql`; the production workflow applies it before deploying this version.

## One stream, optional filters

| Use                            | Endpoint                                  |
| ------------------------------ | ----------------------------------------- |
| Everything, latest 100 events  | /feed.xml                                 |
| Visual feed                    | /                                         |
| Keyword search                 | /?q=authentication                        |
| Everything, JSON               | /api/v1/events                            |
| Technology subscription        | /feed.xml?technology=node-js              |
| CVE subscription               | /feed.xml?cve=CVE-2026-12345              |
| Combined filters               | /api/v1/events?type=patch&technology=ruby |
| Complete archive, oldest first | /api/v1/events?after=0&limit=100          |
| Source catalog                 | /api/v1/sources?page=1                    |

There are no separate feeds per publisher. Source categories describe provenance; all published events enter the same stream. Use any combination of filters to narrow a subscription. Read [API semantics and examples](docs/api.md).

Stable advisory IDs identify a source URL. Each published revision has a new event ID. Corrections retain earlier subscription keys so a consumer following a technology, CVE or event type receives later corrections too. A filtered response can therefore contain a withdrawal or updated classification.

## Run locally

Requires Node.js 22+ and a fresh Supabase project.

1. Run npm ci and copy .env.example to .env.local.
2. Link the Supabase CLI project and run supabase db push. Existing installations apply only migrations they have not already run. Keep the CLI migration history intact; see the operations guide before automating an installation previously configured through the SQL editor.
3. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. These are backend-only variables.
4. Set OPENAI_API_KEY and OPENAI_MODEL to a model supporting Responses structured outputs. Use a provider project with a spending limit.
5. Generate CRON_SECRET with openssl rand -hex 32.
6. Set PUBLIC_BASE_URL=http://localhost:3000 and run npm run dev.

The homepage and source catalog work without credentials. Data endpoints return 503 until the database is available. No sample events are presented as live data.

Populate the shared feed by running the three protected stages, in order initially:

    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect
    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process

Export CRON_SECRET in your shell; reading .env.local does not export it there. Repeat collection and processing until the backlog is drained.

## How it works

1. **Poll:** fetch approved RSS/Atom sources and stage every entry in the fetched feed into a durable queue. Entries beyond the first batch are retained.
2. **Collect:** claim queued entries, extract linked articles or inline notes, and enqueue changed document text. Leases fence superseded workers.
3. **Extract and publish:** classify and extract with structured model output, validate quotations, and atomically publish revisions into the common event stream.

Transport sizes, queue batches, concurrency, retries and extraction attempts are bounded. A database-backed hourly attempt budget applies across overlapping model workers. It is not a currency spending limit.

An irrelevant newer document advances the publication watermark, preventing older work from publishing afterward. If a previously published extraction is reclassified as non-security, the feed emits an explicitly labeled system correction. This is not a claim that the publisher retracted the announcement.

## Deploy

Import this repository into Vercel as a Next.js project and complete the [one-time production setup](docs/operations.md#one-time-setup-before-merging). After that, reviewed merges to main run validation, apply pending Supabase migrations, then deploy the checked commit to Vercel. Production Git auto-deployment is disabled so deployment cannot race migrations; preview branches keep their normal Vercel integration.

The bundled workflow targets heist-security/security-advisory; forks must adapt the repository guards as described in the operations guide. The workflow needs environment-scoped database/Vercel credentials and project identifiers. Missing configuration stops the release. Application credentials stay in Vercel. The three per-minute schedules in vercel.json require a plan supporting that frequency; another scheduler can invoke the same endpoints.

Keep preview credentials separate. Configure edge rate controls, private vulnerability reporting and branch protection before launch. Use the protected /api/cron/health endpoint for queue and source monitoring.

Follow the concrete [operations and launch checklist](docs/operations.md). Repository files do not provision hosting, database resources, DNS, firewall rules or GitHub settings.

## Validation

    npm run format:check
    npm run typecheck
    npm test
    node --test tests/deployment.test.mjs
    npm run build
    npx playwright install chromium
    npm run test:browser
    npm run check:secrets
    npm audit

Tests cover full-feed enumeration, durable collection, stale-worker fencing, corrections, filtered subscription continuity, evidence validation, redirect boundaries, RSS escaping, authentication, database roles and public browser flows.

A separate opt-in live-model evaluation is available:

    npm run eval:live -- --allow-paid

It spends provider credits. The bundled synthetic cases are smoke tests, not a production accuracy benchmark. Run a representative manually labeled corpus with --fixtures=path/to/cases.json --launch before releasing a hosted feed. See [evaluation guidance](docs/evaluation.md).

## Scope and limitations

- Retrieval checks do not establish model accuracy or complete security coverage.
- Quotation matching does not prove product/version association. Unknown information should remain unknown.
- Public feeds expose only a publisher's current feed window. Entries that disappear before polling cannot be recovered without a publisher-specific historical API. Feeds above the explicit transport/entry limits fail visibly; they are not silently truncated.
- Changed article text may create a revision even when its security meaning is unchanged.
- Distinct sources remain distinct advisories; related CVEs are links, not deduplication keys.
- Version strings preserve publisher wording and are not executable semver constraints.
- There is no structured OSV adapter yet.
- Raw source text and queue data are private. Operators must set a retention policy and review upstream terms.

## Contribute and report issues

See [CONTRIBUTING.md](CONTRIBUTING.md) for source criteria and development checks, and [SECURITY.md](SECURITY.md) for private security reporting.

Code: [MIT](LICENSE). Branding and upstream content: [NOTICE.md](NOTICE.md).
