# Structured advisory ingestion

The structured feed imports OSV, the official CVE List and CISA KEV. It uses the existing poll → collect → process → events queues, RSS and JSON subscriptions. Structured publication needs no model credentials and makes no LLM calls. The [publisher activation release](publisher-activation.md) adds all 374 publisher sources when Production opts in with `VENDOR_SOURCE_IDS=all`. Empty selection remains the default for local and Preview environments.

## Data and semantics

| Input                                                        | Delivery                                                          | Meaning                                                                                                                                                            |
| ------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| [OSV](https://google.github.io/osv.dev/data/)                | Recent prefix of `modified_id.csv`, then records from the OSV API | Package identities, ecosystem-specific affected ranges, explicit fixed boundaries, aliases and withdrawals. GitHub Advisory Database is already included upstream. |
| [Official CVE List](https://github.com/CVEProject/cvelistV5) | Rolling `cves/deltaLog.json`, then individual CVE JSON records    | Published or rejected CVE records across software and hardware. Delivery timestamps detect backdated record corrections.                                           |
| [CISA KEV](https://github.com/cisagov/kev-data)              | Full bounded JSON snapshot from CISA's official mirror            | Confirmed exploitation, CISA actions and catalog additions, edits and removals. Federal due dates are not customer-specific deadlines.                             |
| [FIRST EPSS](https://www.first.org/epss/data)                | Small batched API lookups through `/api/v1/risk`                  | Dated global exploitation probability and percentile, not asset-specific exposure or severity.                                                                     |
| [NVD](https://nvd.nist.gov/developers/vulnerabilities)       | Optional single-CVE enrichment through `/api/v1/risk?nvd=1`       | Additional metrics, configurations and weakness data. Availability or enrichment delays never block advisory publication.                                          |

Structured payloads include `structured.provider`, `id`, `modified`, `aliases`, `affected`, `references` and optional upstream IDs/metrics/provider metadata/exploitation context. OSV `upstream` IDs remain in `structured.upstream`, separate from aliases. Upstream CVEs also enter `related_cves` with `/upstream` evidence, making them available to CVE subscriptions and linked risk context. An upstream relationship does not merge a distribution advisory with the upstream record or transfer the distribution's severity to the upstream CVE or other packages. Native affected objects retain package ecosystems, PURLs, version-type rules, default statuses, version changes, Git ranges and distribution backports. Consumers should use these objects for matching; generic technology strings and display fields are not proof that an asset is vulnerable.

Display summaries are bounded and stripped of HTML. Structured `evidence` values identify upstream records or JSON pointers, rather than purported quotations. An unaffected CVE version or range boundary is not automatically treated as a fixed release. An OSV Git fix is not labeled as a package version. Explicit OSV severity labels take precedence; otherwise the highest valid CVSS v3.0/v3.1 base score or v4.0 vector score supplies the severity, with evidence pointing to that source metric. Original vectors remain in `structured.metrics`. Missing, malformed, unsupported and zero scores remain unrated (the feed has no `none` severity). Oversized normalized records fail visibly instead of silently discarding native affected data.

### Refreshing previously imported OSV records

Older normalized documents discarded `upstream`, so processing those documents again cannot recover the CVEs. After deploying the updated importer and migration `202610250013_osv_upstream_priority.sql`, recollect completed OSV entries from the API:

```sh
npm run sources:recollect-osv -- --id=CGA-p5j4-h8gr-5xgh
npm run sources:recollect-osv -- --id=CGA-p5j4-h8gr-5xgh --apply
# Preview all completed OSV entries, then requeue them:
npm run sources:recollect-osv -- --all
npm run sources:recollect-osv -- --all --apply
```

The command uses the configured backend database and defaults to a dry run. It pages completed entries in batches of 100 and conditionally requeues only entries whose status and fingerprint still match. Pending, processing and failed entries are left alone; normal collection and processing publish revisions for changed normalized payloads. Source checkpoints, original dates, event history and existing subscriptions are preserved. Unchanged normalized documents are deduplicated. Monitor collection/processing health until the backlog drains; this command queues work rather than publishing synchronously.

OSV IDs are deduplicated across ecosystem index entries. CVE aliases correlate source records, but OSV, CVE and KEV remain attributable events: one CVE can have different packages, distro fixes and exploitation updates. They are not blindly collapsed by CVE ID. The same source/URL/content is idempotent, and changed documents publish revisions through the existing fenced publication RPC. Withdrawals, CVE rejections and KEV removals remain in earlier technology/CVE subscriptions. Removal from KEV is not evidence that exploitation never occurred.

## Activation after database readiness

Migration `202610240006_structured_bootstrap.sql` registers and enables OSV, CVE and KEV after the existing schema/RPC migrations, and disables the historical vendor sources without deleting their history. The existing Production workflow applies pending migrations when the reviewed PR is merged to `main`, before deploying that same commit. Opening the PR does not apply production migrations. Keep production cron paused until credentials are replaced and launch checks are complete.

New sources start at **2026-09-24T00:00:00Z**, one calendar month before the operator's 24 October 2026 request, using UTC midnight. This is a fixed date, not a moving lookback on every release. An existing source checkpoint is preserved; this migration does not rewind an already-running feed. KEV still imports its complete current catalog, including older entries, so removals can be detected correctly.

The live CVE delta log inspected on 24 October began at `2026-09-24T20:22:53.700Z`, which misses the beginning of the requested window. The new CVE cursor therefore starts with immutable upstream commit [`c21430318b4b48252dd6ba344df26d60e6354f12`](https://github.com/CVEProject/cvelistV5/commit/c21430318b4b48252dd6ba344df26d60e6354f12) in `verification.sync.cve_bootstrap_ref`. Its delta log was parsed read-only: it covers `2026-09-23T23:16:28.460Z` through `2026-10-23T23:08:54.357Z`, with 28,677 unique CVE IDs selected from the requested start. This verifies discovery coverage, not successful ingestion or publication.

The importer pages that snapshot under the same 64 MB transport and 2,000-record staging limits, retaining the pinned ref until every page has been staged. It then removes the ref and continues from the snapshot's final delivery timestamp against the live delta log. It does not rewind the cursor or silently skip an unavailable archive or a gap at handoff. If launch is delayed until the live log no longer overlaps the snapshot, an additional reviewed backfill is required. Records are fetched in their current upstream form; this is not a reconstruction of every historical record revision.

1. Deploy this reviewed application with Production-only Supabase credentials and `CRON_SECRET`. Structured ingestion does not require `OPENAI_API_KEY` or `OPENAI_MODEL`.
2. Leave `VENDOR_SOURCE_IDS` empty for the default configuration. To add selected vendor gaps, set a comma-separated list of exact IDs from `sources/registry.json`, with a documented reason and evaluated extraction model/provider controls. The same value must be used by the configuration command and deployed application.
3. Verify the migration-created source rows and initial checkpoints. No additional `sources:configure --apply` is needed for this structured-only launch. For later source-selection changes, preview with `npm run sources:configure -- --since=2026-09-24T00:00:00Z`. `--since` only initializes missing sources; it does not override existing checkpoints or provide a CVE archive by itself. Omitting it retains the command's 24-hour default for missing sources.
4. Only when intentionally changing source selection, run the same command with `--apply`. It preserves checkpoints (including the CVE bootstrap ref), documents and events. It does not alter schema or apply SQL. Repeating it reconciles configuration; it deliberately re-enables the selected sources.
5. Run authenticated poll, collect and process; verify populated JSON/RSS and authenticated health before enabling scheduled cron. Health reports degraded if core sources or their checkpoints are missing/disabled. No live database validation or 24-hour observation is implied by local tests.

Production credentials must never be used in Preview. Source configuration commands must not run in untrusted PR workflows. Replacing the provisional application/cron secrets, successful production migration execution and hosted validation remain prerequisites from the operations handoff. No new paid model usage is required for the structured default.

The existing table constrains `adapter` to article or feed-content. Reserved core IDs use feed-content as the inline queue storage mode, with explicit deterministic dispatch by ID. Source configuration lives separately from the historical RSS registry generator; do not run a legacy registry migration after configuration without reconciling it again.

## Checkpoints and capacity

Each core source keeps durable `verification.sync` state in its existing source row. HTTP validators are not used as cursors. The cursor advances only after all selected entries are staged under the source lease. A crash replays safely. OSV paging uses a frozen upper timestamp, stable timestamp/ID ordering and a five-minute overlap. CVE paging uses delta delivery timestamps, not mutable publication dates. Changes that arrive during a page sweep are picked up in subsequent sweeps.

A poll stages up to 2,000 unique OSV/CVE records in 500-entry transactions. KEV is a complete bounded snapshot so removals can be detected; its entries are also staged in batches of 500. OSV index reads stop at the checkpoint and are bounded to 64 MB, 1,000,000 scanned rows and a 60-second transport timeout. Its newest-first index is streamed into an oldest-first page: at most 2,001 complete records are retained, plus a set of seen IDs for deduplicating ecosystem copies. The frozen window, timestamp/ID cursor and five-minute overlap are preserved across pages. The unpaginated `osvChanges` helper retains its 200,000-row cap. The CVE delta log is bounded to 64 MB. The upstream record limit is 4 MB; the existing normalized-document limit is 50,000 characters. Read limits, invalid data, upstream errors and expired CVE history do not advance the cursor. `structured_backfill_required` requires operator investigation and an explicit historical backfill, not resetting the cursor to now. This serverless implementation does not import the entire historical database.

Structured processing defaults to 120 documents per invocation (`STRUCTURED_PROCESS_BATCH_SIZE`, maximum 1,000). Conditional document updates fence competing workers and expired leases; final publication still uses the existing PostgreSQL transaction and publication lock. Structured claims do not reserve paid extraction attempts. Publisher claims now use `claim_vendor_document`, which filters the selected publisher IDs and excludes core sources while retaining the shared PostgreSQL attempt limit. The legacy claim RPC remains compatible for older deployments.

Existing queued vendor documents are retained. If a vendor is no longer selected, the legacy worker refuses to send its text to the model and records `source_not_selected`; review those historical jobs before enabling a vendor worker. Source health, queue failure counts and oldest pending ages still need external monitoring. Capacity and transport smoke checks are not load-test results.

The existing publication RPC stores `extraction_method=llm` for all non-system publications. Until database metadata is extended separately, public reads derive `extraction_method=structured` from reserved source identity and structured provenance. The persisted model marker is `structured:<provider>:1`; the original raw column must not be used alone for model-cost accounting.

## Risk lookups

`GET /api/v1/risk?cve=CVE-2021-44228,CVE-2026-12345` accepts 1–40 CVEs. Add `nvd=1` for a single CVE. Responses include per-provider availability, the original KEV entry, dated EPSS probability/percentile and optional NVD metadata. A missing result is null, not zero risk. Partial provider failures remain explicit; total unavailability returns 503. Results may be cached for 15 minutes.

This endpoint provides current enrichment for consumers. It does not emit daily EPSS changes as feed events, infer customer exposure, notify customers, or decide remediation automatically. KEV catalog changes do publish events. Customer asset matching and delivery belong in Heist's application, using the feed's stable identifiers and native affected ranges.

The reader displays neutral CVSS and EPSS badges beside severity. CVSS uses the highest available native base score or calculated OSV vector score across active source records and linked CVEs; its tooltip identifies the version and source record. EPSS loads after the cards through batched risk lookups, with the score date and FIRST attribution in its tooltip. Multi-CVE items show the highest available EPSS probability, labelled `EPSS max`, with score coverage in the tooltip. Missing or unavailable scores display a dash; a reported zero remains zero. Withdrawn records and historical CVE routing keys do not contribute scores. These badges enrich the reader without changing RSS/JSON events or severity filters. See [CVSS](https://www.first.org/cvss/) and [EPSS](https://www.first.org/epss/faq) for scoring definitions.

## Verification

Run `npm run sources:verify-structured` for a read-only live transport/parser smoke check: recent indexes, up to three normalized records per source, and a bounded KEV/EPSS/NVD lookup. It accesses no database and makes no model calls. The unit/integration suite covers range preservation, withdrawals, paging ties, stale checkpoints, failed staging, competing claims, lease replacement and risk-provider failures. The live LLM evaluation in `docs/evaluation.md` still applies to any opted-in vendor extraction.

Read-only smoke verification on 24 October 2026 succeeded for three OSV records, three official CVE records and three KEV records, with KEV/EPSS/NVD lookups available. The KEV snapshot contained 1,756 entries. This confirms the sampled transport/parser paths only; it is not a completeness, accuracy, hosted pipeline or load-test result.
