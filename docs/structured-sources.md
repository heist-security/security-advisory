# Structured advisory ingestion

The default feed imports OSV, the official CVE List and CISA KEV. It uses the existing poll → collect → process → events queues, RSS and JSON subscriptions. Structured publication needs no model credentials and makes no LLM calls. The historical 374-stream vendor catalog remains available for explicit opt-in; it is not the default active source set.

## Data and semantics

| Input                                                        | Delivery                                                          | Meaning                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [OSV](https://google.github.io/osv.dev/data/)                | Recent prefix of `modified_id.csv`, then records from the OSV API | Package identities, ecosystem-specific affected ranges, explicit fixed boundaries, aliases and withdrawals. GitHub Advisory Database is already included upstream. |
| [Official CVE List](https://github.com/CVEProject/cvelistV5) | Rolling `cves/deltaLog.json`, then individual CVE JSON records    | Published or rejected CVE records across software and hardware. Delivery timestamps detect backdated record corrections.                                           |
| [CISA KEV](https://github.com/cisagov/kev-data)              | Full bounded JSON snapshot from CISA's official mirror            | Confirmed exploitation, CISA actions and catalog additions, edits and removals. Federal due dates are not customer-specific deadlines.                             |
| [FIRST EPSS](https://www.first.org/epss/data)                | Small batched API lookups through `/api/v1/risk`                  | Dated global exploitation probability and percentile, not asset-specific exposure or severity.                                                                     |
| [NVD](https://nvd.nist.gov/developers/vulnerabilities)       | Optional single-CVE enrichment through `/api/v1/risk?nvd=1`       | Additional metrics, configurations and weakness data. Availability or enrichment delays never block advisory publication.                                          |

Structured payloads include `structured.provider`, `id`, `modified`, `aliases`, `affected`, `references` and optional metrics/provider metadata/exploitation context. Native affected objects retain package ecosystems, PURLs, version-type rules, default statuses, version changes, Git ranges and distribution backports. Consumers should use these objects for matching; generic technology strings and display fields are not proof that an asset is vulnerable.

Display summaries are bounded and stripped of HTML. Structured `evidence` values identify upstream records or JSON pointers, rather than purported quotations. An unaffected CVE version or range boundary is not automatically treated as a fixed release. An OSV Git fix is not labeled as a package version. Severity remains unknown unless explicitly labeled by the source; this adapter does not compute CVSS vector scores. Oversized normalized records fail visibly instead of silently discarding native affected data.

OSV IDs are deduplicated across ecosystem index entries. CVE aliases correlate source records, but OSV, CVE and KEV remain attributable events: one CVE can have different packages, distro fixes and exploitation updates. They are not blindly collapsed by CVE ID. The same source/URL/content is idempotent, and changed documents publish revisions through the existing fenced publication RPC. Withdrawals, CVE rejections and KEV removals remain in earlier technology/CVE subscriptions. Removal from KEV is not evidence that exploitation never occurred.

## Activation after database readiness

This change contains no migration and does not apply migrations. The separately managed database work must establish the existing repository schema and RPCs first. Keep production cron paused until credentials are replaced and launch checks are complete.

1. Deploy this reviewed application with Production-only Supabase credentials and `CRON_SECRET`. Structured ingestion does not require `OPENAI_API_KEY` or `OPENAI_MODEL`.
2. Leave `VENDOR_SOURCE_IDS` empty for the default configuration. To add selected vendor gaps, set a comma-separated list of exact IDs from `sources/registry.json`, with a documented reason and evaluated extraction model/provider controls. The same value must be used by the configuration command and deployed application.
3. Run `npm run sources:configure -- --since=2026-10-24T00:00:00Z` to review the configuration. Choose the actual intended start timestamp; the example is not a complete historical backfill. Omitting `--since` starts 24 hours before the command.
4. Run the same command with `--apply` when ready. This registers the three core source rows, enables selected sources and disables other source rows using existing tables. It preserves checkpoints, documents and events. It does not alter schema or apply SQL. Repeating it reconciles configuration; it deliberately re-enables the selected sources.
5. Run authenticated poll, collect and process; verify populated JSON/RSS and authenticated health before enabling scheduled cron. Health reports degraded if core sources or their checkpoints are missing/disabled. No live database validation or 24-hour observation is implied by local tests.

Production credentials must never be used in Preview. Source configuration commands must not run in untrusted PR workflows. Replacing the provisional database/cron secrets, separately managed migrations and hosted validation remain prerequisites from the operations handoff. No new paid model usage is required for the structured default.

The existing table constrains `adapter` to article or feed-content. Reserved core IDs use feed-content as the inline queue storage mode, with explicit deterministic dispatch by ID. Source configuration lives separately from the historical RSS registry generator; do not run a legacy registry migration after configuration without reconciling it again.

## Checkpoints and capacity

Each core source keeps durable `verification.sync` state in its existing source row. HTTP validators are not used as cursors. The cursor advances only after all selected entries are staged under the source lease. A crash replays safely. OSV paging uses a frozen upper timestamp, stable timestamp/ID ordering and a five-minute overlap. CVE paging uses delta delivery timestamps, not mutable publication dates. Changes that arrive during a page sweep are picked up in subsequent sweeps.

A poll stages up to 2,000 unique OSV/CVE records in 500-entry transactions. KEV is a complete bounded snapshot so removals can be detected; its entries are also staged in batches of 500. OSV index reads stop at the checkpoint and are bounded to 64 MB/200,000 rows. The CVE delta log is bounded to 64 MB. The upstream record limit is 4 MB; the existing normalized-document limit is 50,000 characters. Read limits, invalid data, upstream errors and expired CVE history do not advance the cursor. `structured_backfill_required` requires operator investigation and an explicit historical backfill, not resetting the cursor to now. This serverless implementation does not import the entire historical database.

Structured processing defaults to 120 documents per invocation (`STRUCTURED_PROCESS_BATCH_SIZE`, maximum 1,000). Conditional document updates fence competing workers and expired leases; final publication still uses the existing PostgreSQL transaction and publication lock. Structured claims do not reserve paid extraction attempts. Existing vendor claims retain the shared PostgreSQL attempt limit. If the legacy worker races for a structured document, it also uses the deterministic path, conservatively consuming one legacy claim slot but making no model call.

Existing queued vendor documents are retained. If a vendor is no longer selected, the legacy worker refuses to send its text to the model and records `source_not_selected`; review those historical jobs before enabling a vendor worker. Source health, queue failure counts and oldest pending ages still need external monitoring. Capacity and transport smoke checks are not load-test results.

The existing publication RPC stores `extraction_method=llm` for all non-system publications. Until database metadata is extended separately, public reads derive `extraction_method=structured` from reserved source identity and structured provenance. The persisted model marker is `structured:<provider>:1`; the original raw column must not be used alone for model-cost accounting.

## Risk lookups

`GET /api/v1/risk?cve=CVE-2021-44228,CVE-2026-12345` accepts 1–40 CVEs. Add `nvd=1` for a single CVE. Responses include per-provider availability, the original KEV entry, dated EPSS probability/percentile and optional NVD metadata. A missing result is null, not zero risk. Partial provider failures remain explicit; total unavailability returns 503. Results may be cached for 15 minutes.

This endpoint provides current enrichment for consumers. It does not emit daily EPSS changes as feed events, infer customer exposure, notify customers, or decide remediation automatically. KEV catalog changes do publish events. Customer asset matching and delivery belong in Heist's application, using the feed's stable identifiers and native affected ranges.

## Verification

Run `npm run sources:verify-structured` for a read-only live transport/parser smoke check: recent indexes, up to three normalized records per source, and a bounded KEV/EPSS/NVD lookup. It accesses no database and makes no model calls. The unit/integration suite covers range preservation, withdrawals, paging ties, stale checkpoints, failed staging, competing claims, lease replacement and risk-provider failures. The live LLM evaluation in `docs/evaluation.md` still applies to any opted-in vendor extraction.

Read-only smoke verification on 24 October 2026 succeeded for three OSV records, three official CVE records and three KEV records, with KEV/EPSS/NVD lookups available. The KEV snapshot contained 1,756 entries. This confirms the sampled transport/parser paths only; it is not a completeness, accuracy, hosted pipeline or load-test result.
