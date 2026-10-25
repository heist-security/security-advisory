# Contributing

Please open an issue for substantial changes before implementation. Use the private channel in SECURITY.md for security vulnerabilities.

## Development

Use Node.js 22 or later, run npm ci, and follow the README for database setup.

Before a pull request:

    npm run format
    npm run typecheck
    npm test
    npm run build
    npm run test:browser
    npm run check:secrets

Browser tests require Chromium: npx playwright install chromium.

The feed UI uses [shadcn/ui](https://ui.shadcn.com/docs) with Tailwind CSS v4.
Reusable components live in `src/components/ui`; add more with
`npx shadcn@latest add <component>`. Keep shared colors and typography in
`src/app/globals.css` and use the `cn` helper in `src/lib/utils.ts` when composing
classes. `src/app/site.css` retains the styles for the shared shell and other pages
in the components layer so Tailwind utilities can override them.

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
