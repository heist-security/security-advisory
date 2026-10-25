# Heist Feed

Heist Feed is a self-hosted security advisory reader built with Next.js, TypeScript, and Supabase. It imports OSV, the official CVE List, and CISA KEV, then publishes advisories, patches, mitigations, and corrections through a web interface, RSS, and a JSON API.

Structured ingestion runs without an LLM. Optional publisher feeds use model-assisted extraction with source quotations. Records retain their upstream identifiers, affected-version data, and revision history. Confirmed copies of an advisory are grouped in the reader; individual source events remain available through the API.

The project is in alpha. Coverage depends on the configured sources and ingestion checkpoints. Consult original advisories when assessing affected versions or remediation.

## Requirements

- Node.js 22.13 or later and npm.
- A Supabase project and the Supabase CLI for database setup.
- OpenAI credentials only if you enable publisher extraction.

## Local setup

```sh
npm ci
cp .env.example .env.local
```

For a new Supabase project, authenticate with the CLI, link the project, and apply the migrations:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Set these values in `.env.local`:

| Variable                    | Purpose                                                 |
| --------------------------- | ------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL                                    |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side database credential                         |
| `CRON_SECRET`               | Bearer token for ingestion and health endpoints         |
| `PUBLIC_BASE_URL`           | Public application URL; locally `http://localhost:3000` |

Generate a cron secret with `openssl rand -hex 32`. Keep the service-role key and cron secret on the server. The remaining settings and ingestion limits are listed in [.env.example](.env.example).

Review the source configuration, then apply it:

```sh
npm run sources:configure
npm run sources:configure -- --apply
npm run dev
```

Open <http://localhost:3000>. Without database credentials, the interface and source catalog are accessible, but data endpoints return `503`.

The configuration command enables the three structured sources and any explicitly selected publisher feeds. It preserves existing checkpoints. For checkpoint selection, recovery, and existing installations, see [structured ingestion](docs/structured-sources.md) and [operations](docs/operations.md).

To populate the feed, export the same `CRON_SECRET` in your shell and call the stages in order:

```sh
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/poll
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/collect
curl --fail -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process
```

Repeat collection and processing while work remains queued. The protected `/api/cron/health` endpoint reports queue and source status.

### Optional publisher feeds

Set `VENDOR_SOURCE_IDS` to a comma-separated list of registry IDs, or `all`, and configure `OPENAI_API_KEY` and `OPENAI_MODEL`. Run `sources:configure` again to reconcile the selection. An empty selection disables publisher extraction. Configure provider spending limits separately from the application's hourly attempt limit.

See [publisher activation](docs/publisher-activation.md) and [extraction evaluation](docs/evaluation.md) before enabling this path.

## Interface and API

| Endpoint                           | Description                        |
| ---------------------------------- | ---------------------------------- |
| `/`                                | Advisory reader and filters        |
| `/sources`                         | Configured source catalog          |
| `/docs`                            | API documentation                  |
| `/feed.xml`                        | RSS of source events               |
| `/api/v1/events`                   | JSON of source events              |
| `/api/v1/events?view=grouped`      | Grouped advisories                 |
| `/api/v1/events?after=0&limit=100` | Source event archive, oldest first |
| `/api/v1/technologies`             | Technology suggestions             |
| `/api/v1/sources`                  | Source catalog as JSON             |
| `/api/v1/risk?cve=CVE-2021-44228`  | Exploitation and risk context      |

RSS and JSON support shared filters such as `technology=node-js`, `type=advisory,patch`, `severity=critical,high`, `cve`, and `source`. The reader's subscription links use `view=grouped`. Source events and grouped updates have separate cursors and RSS identifiers; start a fresh cursor when switching views.

Corrections retain earlier subscription keys so existing subscribers receive withdrawals and classification changes. See [API semantics](docs/api.md) and [advisory grouping](docs/advisory-grouping.md) for response formats, pagination, and revision behavior.

## Development

```sh
npm run check          # ESLint, Prettier, TypeScript, unit/database and release tests
npm run build
npx playwright install chromium
npm run test:browser
npm run check:secrets
```

Use `npm run lint:fix` for fixable lint errors and `npm run format` to format the project. CI checks both. Browser tests run against a local fixture server and the production build; they do not need Supabase or OpenAI credentials. Database tests use PGlite. The production workflow also exercises migrations and API queries against disposable PostgreSQL and PostgREST services.

The UI uses shadcn/ui components and Tailwind CSS throughout. Shared components live in `src/components/ui`, and theme tokens are defined in `src/app/globals.css`.

| Directory             | Contents                                            |
| --------------------- | --------------------------------------------------- |
| `src/app`             | Pages, public API routes, and protected cron routes |
| `src/components`      | Reader components and shared UI primitives          |
| `src/lib`             | Ingestion, validation, querying, and serialization  |
| `sources`             | Publisher registry and verification data            |
| `supabase/migrations` | Database schema and incremental migrations          |
| `scripts`             | Source management and evaluation tools              |
| `tests`               | Functional, database, and browser regression tests  |
| `docs`                | API, deployment, and ingestion documentation        |

## Deployment

The repository includes Vercel schedules and a GitHub Actions workflow that validates changes, applies Supabase migrations, completes backfills, and deploys the checked commit. The release job is restricted to the upstream repository. Forks must configure their own repository guard, credentials, and hosting settings.

Follow the [operations guide](docs/operations.md) for setup and deployment. Keep preview credentials separate from production. If your hosting plan does not support the bundled cron frequency, use another scheduler to invoke the protected endpoints.

## Contributing and security

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and source contribution guidelines. Report vulnerabilities through the private channel described in [SECURITY.md](SECURITY.md).

The code is licensed under [MIT](LICENSE). Third-party notices, branding, and upstream data terms are described in [NOTICE.md](NOTICE.md).
