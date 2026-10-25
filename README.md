# Heist Feed

**One open feed for security advisories, patches and mitigations.**

Heist Feed combines structured vulnerability advisories and exploitation updates in one RSS feed and one JSON API. Selected publisher announcements and release notes can supplement that coverage. Subscribe to everything, or filter the same stream by technology, event type, CVE or source.

Every event links to its source. Structured records preserve upstream identifiers and affected-version data; optional vendor extraction includes supporting quotations and can capture fixes without a new CVE.

**Status: alpha.** Structured OSV, official CVE List and CISA KEV records require no LLM calls. Production can select all 374 publisher feeds with `VENDOR_SOURCE_IDS=all`; see [publisher activation and remaining evaluation gates](docs/publisher-activation.md). EPSS and optional NVD data are available through the risk API. See [structured ingestion](docs/structured-sources.md) and the [publisher coverage audit](docs/source-coverage.md). Hosted validation, extraction evaluation and observation remain launch gates.

## Browse the visual feed

The homepage `/` displays a compact list with filters. Each title opens a dedicated detail page. Existing `/feed` links redirect to the homepage with their filters intact. Search announcements, filter by type, technology, CVE or source, and open each item to inspect version details, source evidence and revision history. Structured imports identify source records and fields; vendor extractions include quotations. URLs preserve the current view, and its RSS/JSON links use the same filters. No account is required.

The reader groups confirmed copies of an advisory into one card, preserving all source evidence and revision history. Its JSON/RSS links use `view=grouped`; existing event subscriptions remain compatible. See [grouping and subscription semantics](docs/advisory-grouping.md). The production workflow applies migrations and finishes the grouping backfill before deploying this version.

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
4. Review `npm run sources:configure`, then run it with `--apply` to register the core sources using the existing schema. Set `VENDOR_SOURCE_IDS`, `OPENAI_API_KEY` and `OPENAI_MODEL` only for opted-in vendor extraction, with an agreed provider spending limit.
5. Generate CRON_SECRET with openssl rand -hex 32.
6. Set PUBLIC_BASE_URL=http://localhost:3000 and run npm run dev.

The homepage and source catalog work without credentials. Data endpoints return 503 until the database is available. No sample events are presented as live data.

Populate the shared feed by running the three protected stages, in order initially:

    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect
    curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process

Export CRON_SECRET in your shell; reading .env.local does not export it there. Repeat collection and processing until the backlog is drained.

## How it works

1. **Poll:** checkpoint structured change indexes and KEV snapshots into a durable queue. Selected vendor feeds use the existing RSS/Atom adapter.
2. **Collect:** normalize structured records directly, preserving native affected data. Vendor entries collect linked articles or inline notes. Leases fence superseded workers.
3. **Process and publish:** structured records publish deterministically without a model. Opted-in vendor documents use the evaluated extraction model and quote validation. Both paths use the same atomic publication transaction and event stream.

Transport sizes, queue batches, concurrency, retries and extraction attempts are bounded. A database-backed hourly attempt budget applies across overlapping model workers. It is not a currency spending limit.

An irrelevant newer document advances the publication watermark, preventing older work from publishing afterward. If a previously published extraction is reclassified as non-security, the feed emits an explicitly labeled system correction. This is not a claim that the publisher retracted the announcement.

## Deploy

Import this repository into Vercel as a Next.js project and complete the [one-time production setup](docs/operations.md#one-time-setup-before-merging). After that, reviewed merges to main run validation, apply pending Supabase migrations, then deploy the checked commit to Vercel. Production Git auto-deployment is disabled so deployment cannot race migrations; preview branches keep their normal Vercel integration.

The bundled workflow targets heist-security/security-advisory; forks must adapt the repository guards as described in the operations guide. The workflow needs environment-scoped database/Vercel credentials and project identifiers. Missing configuration stops the release. Application credentials stay in Vercel. The three per-minute schedules in vercel.json require a plan supporting that frequency; another scheduler can invoke the same endpoints.

After database readiness, reconcile source configuration as described above before activating ingestion. Keep preview credentials separate. Configure edge rate controls, private vulnerability reporting and branch protection before launch. Use the protected /api/cron/health endpoint for queue and source monitoring.

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

It spends provider credits. The bundled synthetic cases are smoke tests, not a production accuracy benchmark. Run a representative manually labeled corpus with --fixtures=path/to/cases.json --launch before enabling vendor model extraction for a hosted feed. See [evaluation guidance](docs/evaluation.md).

## Scope and limitations

- Retrieval checks do not establish model accuracy or complete security coverage.
- Quotation matching does not prove product/version association. Unknown information should remain unknown.
- Public feeds expose only a publisher's current feed window. Entries that disappear before polling cannot be recovered without a publisher-specific historical API. Feeds above the explicit transport/entry limits fail visibly; they are not silently truncated.
- Changed article text may create a revision even when its security meaning is unchanged.
- Source records remain distinct. Confirmed OSV mirrors share a display group; related CVEs alone are not deduplication keys.
- Vendor display version strings preserve publisher wording. Structured affected data retains each upstream format and ecosystem semantics; consumers need format-aware matching.
- Structured startup imports changes since an explicit checkpoint, not the full historical database. Expired upstream history and oversized data fail visibly.
- Raw source text and queue data are private. Operators must set a retention policy and review upstream terms.

## Contribute and report issues

See [CONTRIBUTING.md](CONTRIBUTING.md) for source criteria and development checks, and [SECURITY.md](SECURITY.md) for private security reporting.

Code: [MIT](LICENSE). Branding and upstream content: [NOTICE.md](NOTICE.md).

## Structured sources

Configure sources with `npm run sources:configure` (dry-run), then `--apply` after database setup. The publisher activation migration enables the reviewed catalog on merge; Production also sets `VENDOR_SOURCE_IDS=all` and the OpenAI settings. `VENDOR_SOURCE_IDS` is empty by default for local and Preview environments. Read [publisher activation](docs/publisher-activation.md) and [checkpoint recovery](docs/structured-sources.md).

The public source catalog shows the three core inputs plus selected vendors. Use `/sources?catalog=vendor` or `/api/v1/sources?catalog=vendor` to browse the historical optional catalog. Use `/api/v1/risk?cve=CVE-2021-44228` for exploitation context, optionally adding `&nvd=1` for single-CVE NVD enrichment.
