# Heist Feed

Heist Feed collects security advisories and patches from OSV, the official CVE List, CISA KEV, and optional publisher feeds. The website, RSS, and JSON API read one canonical `feed_items` table.

Each item has directly queryable products, affected and fixed versions, CVEs, severity, and sources. Source evidence and native affected-package data remain attached. Patch releases combine only when the same publisher explicitly fixes the exact same vulnerabilities for the same products. Mere CVE mentions and publication dates do not establish a match.

The project is in alpha. Coverage depends on sources and checkpoints; consult original advisories for remediation decisions.

## Setup

Use Node.js 22.13 or later, PostgreSQL (Supabase is supported), and the Supabase CLI for migrations. OpenAI credentials are needed only for optional publisher extraction.

```sh
npm ci
cp .env.example .env.local
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Set `DATABASE_URL` to a server-side PostgreSQL connection string, `DATABASE_CA_CERT` if your provider requires its CA certificate, `CRON_SECRET` to a random bearer token, and `PUBLIC_BASE_URL` to your application URL. Remote database connections verify TLS certificates. Use a pooled connection for serverless hosting. These credentials must never reach the browser.

```sh
npm run feed:migrate
npm run sources:configure       # preview selection
npm run sources:configure -- --apply
npm run dev
```

Open <http://localhost:3000>. Without database credentials the reader shows an unavailable state. Apply the [upgrade procedure](docs/operations.md) before deploying over an existing installation; this release changes the API and removes the old runtime schema.

To ingest, call the stages in order with the same `CRON_SECRET` exported in your shell:

```sh
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process
```

Repeat collection and processing while work remains. `/api/cron/health` reports queue status. Structured ingestion makes no model calls. Publisher feeds require `VENDOR_SOURCE_IDS`, `OPENAI_API_KEY`, and `OPENAI_MODEL`; see [publisher activation](docs/publisher-activation.md).

## Interface

| Endpoint                          | Purpose                                    |
| --------------------------------- | ------------------------------------------ |
| `/`                               | Reader and filters                         |
| `/items/{id}`                     | Item, versions, and source evidence        |
| `/feed.xml`                       | Recent item revisions                      |
| `/api/v1/items`                   | Current items, newest first                |
| `/api/v1/items?after=0&limit=100` | Current item states in change-cursor order |
| `/api/v1/technologies`            | Observed technology suggestions            |
| `/sources`, `/api/v1/sources`     | Configured source catalog                  |
| `/docs`                           | Public API guide                           |
| `/api/v1/risk?cve=CVE-2021-44228` | Optional dated risk enrichment             |
| `/sitemap.xml`                    | Current item sitemap                       |

RSS and JSON share filters with the website. Read [API semantics](docs/api.md) for corrections and cursors: this is a current-state feed, not a historical event log.

## Architecture

| Directory                   | Responsibility                                                      |
| --------------------------- | ------------------------------------------------------------------- |
| `src/domain`                | Evidence, feed items, identity and reconciliation; no I/O           |
| `src/application`           | Ingestion and publication use cases; adapter interfaces             |
| `src/adapters`              | PostgreSQL, publisher/structured sources, OpenAI and risk providers |
| `src/server`                | Composition root wiring adapters to use cases                       |
| `src/presentation`          | Filters, links, RSS and HTTP helpers                                |
| `src/app`, `src/components` | Next.js routes and UI                                               |
| `supabase/migrations`       | Append-only schema history                                          |
| `scripts`                   | Import, source management and evaluation                            |

See [the architecture and domain rules](docs/architecture.md). The original migration files remain unchanged for existing installations. Their former runtime projections are removed during cutover.

## Development

```sh
npm run check
npm run build
npx playwright install chromium
# Disposable local PostgreSQL; browser tests create and remove their own database.
TEST_DATABASE_URL=postgresql://localhost/postgres npm run test:browser
npm run check:secrets
```

Unit/database tests use PGlite. CI reruns the database contract against PostgreSQL 17 and runs browser tests against the production build with a real PostgreSQL adapter. No provider or model credentials are needed. See [CONTRIBUTING.md](CONTRIBUTING.md).

The production workflow applies migrations, imports the canonical feed, and then deploys the checked commit. Follow [operations](docs/operations.md) for the maintenance window and environment changes. No production action is performed by editing this repository.

Original code is [MIT licensed](LICENSE). See [NOTICE.md](NOTICE.md) for third-party data and branding terms, and [SECURITY.md](SECURITY.md) for vulnerability reporting.
