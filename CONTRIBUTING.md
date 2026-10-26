# Contributing

Please open an issue for substantial changes before implementation. Use the private channel in SECURITY.md for security vulnerabilities.

## Development

Use Node.js 22.13 or later, run `npm ci`, and follow the README for database setup.

Before a pull request:

    npm run format
    npm run check
    npm run build
    npm run test:browser
    npm run check:secrets

Browser tests require a production build and Chromium: `npm run build` and
`npx playwright install chromium`. They use a local fixture database API.
Unit and database tests run with Vitest and PGlite; release-script tests run with
Node’s test runner. The PostgreSQL/PostgREST integration checks run in CI.

`npm run check` runs linting, formatting checks, type checking, and functional
tests. Use `npm run lint:fix` for automatic lint fixes. ESLint uses the recommended
JavaScript, [Next.js Core Web Vitals and TypeScript flat configurations](https://nextjs.org/docs/app/api-reference/config/eslint), with
`eslint-config-prettier` keeping formatting rules separate.

The TypeScript 7 compiler runs via the `@typescript/native` npm alias. The
`typescript` alias provides [Microsoft’s TypeScript 6 compatibility API](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0) required
by typescript-eslint. Keep both until the parser supports the TypeScript 7 API.

The entire UI uses [shadcn/ui](https://ui.shadcn.com/docs) with Tailwind CSS v4.
Reusable components live in `src/components/ui`; add more with
`npx shadcn@latest add <component>`. Keep shared colors and typography in
`src/app/globals.css` and use the `cn` helper in `src/lib/utils.ts` when composing
classes. Use those primitives and Tailwind utilities for pages, forms, navigation, and
status messages; avoid introducing a parallel page-specific stylesheet.

Keep tests focused on current behavior. Avoid screenshot generation, pixel-level
layout assertions, frozen source counts, or tests for superseded implementations.
Keep changes focused. Add regression coverage for ingestion, publication, filter and access-control changes. Never commit credentials, .env files or real customer data.

## Source contributions

The default inputs are structured OSV, official CVE List and CISA KEV. Keep their adapters deterministic and preserve native version semantics, corrections and provenance. Run `npm run sources:verify-structured` for transport/parser checks; it does not test a live database or model quality. Add regression tests for pagination, checkpoints, record identity and withdrawals.

Vendor streams are optional. Document the coverage or timeliness gap they address, select their IDs in `VENDOR_SOURCE_IDS`, and reconcile application configuration with `npm run sources:configure`. See [structured-source operations](docs/structured-sources.md). The historical RSS catalog workflow below is for maintaining that optional catalog, not activating all streams by default.

Edit sources/candidates.json with publisher provenance, channel, adapter, exact HTTPS origins, optional repository path prefix, rationale and limitations. Prefer primary publishers and upstream repositories.

Run npm run sources:verify with outbound network access. Review failed entries and sampled content, then generate a NEW migration using npm run sources:build -- --migration=YYYYMMDDHHMM_descriptive_name.sql. The command refuses to overwrite an existing migration. Do not edit applied migrations or inflate source counts with unreachable or tag-only feeds.

A verification check means retrieval and parsing succeeded. It does not prove model accuracy, complete coverage or an upstream redistribution license. Document rate limits and publisher terms. Add adapter fixtures when a generic extractor is insufficient.

If removing a source, the generated migration disables the removed row instead of deleting its history. Existing operator disable choices for retained sources remain intact.

## Code and data

Original code contributions are provided under the MIT license. Keep third-party notices intact. Heist branding and upstream content are governed separately; see NOTICE.md.
