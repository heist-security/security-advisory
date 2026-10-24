# Publisher source activation

This release enables the 374 reviewed publisher sources in `sources/registry.json`, alongside OSV, the CVE List and CISA KEV (377 configured sources). The Production workflow applies `202610240007_enable_vendor_sources.sql` on merge, then deploys the checked commit. Opening this PR does not enable production sources or run paid extraction.

The migration changes the reviewed source rows and adds a service-role-only `claim_vendor_document` RPC. It retains existing core checkpoints, source metadata, documents and events. Publisher extraction claims only the configured publisher IDs, so a structured extraction backlog cannot consume the publisher attempt budget. The legacy claim RPC remains compatible and shares the same transaction lock/counter.

## Production configuration

Configure these only in Vercel **Production** before merging:

| Variable                  | Value                                                                          |
| ------------------------- | ------------------------------------------------------------------------------ |
| `OPENAI_API_KEY`          | Restricted `security-advisory-production` key; Responses write permission only |
| `OPENAI_MODEL`            | `gpt-6-luna`                                                                   |
| `OPENAI_REASONING_EFFORT` | `none`                                                                         |
| `VENDOR_SOURCE_IDS`       | `all`                                                                          |
| `EXTRACTION_HOURLY_LIMIT` | `60`                                                                           |
| `PROCESS_BATCH_SIZE`      | `1`                                                                            |
| `PROCESS_CONCURRENCY`     | `1`                                                                            |

`all` expands to the checked-in registry, not arbitrary database rows. Explicit comma-separated IDs are also supported; unknown IDs fail configuration. An empty selection disables the model path. Keep the API key and vendor selection out of Preview; Preview uses a separate database.

The chosen [model](https://developers.openai.com/api/docs/models/gpt-6-luna) supports Responses structured outputs and reasoning `none`. OpenAI currently documents `gpt-6-luna` as the request ID without a separately dated snapshot. Record this limitation and rerun quality evaluation when model behavior or the extraction prompt changes. This model is an extraction candidate, not an evaluated quality claim.

Every claim reserves an attempt in the existing database-enforced hourly budget, including failures and retries. Empty claims reserve nothing; exhausted jobs stop after five attempts. Each response is limited to 5,000 output tokens and each document to 50,000 characters. An attempt limit is not a currency cap. Runtime `extract_usage` logs contain model and token counts only, including cached input and reasoning tokens; source text, outputs and credentials are not logged.

The restricted key is in the existing Heist project, so funding is shared with its other keys; this is not a dedicated project spending limit. Funding is managed by the operator. No additional credit purchase or auto-reload change is part of this setup.

Setup evidence on 24 October 2026: the restricted key was created and saved as a non-revealable Vercel Production secret, and `OPENAI_MODEL=gpt-6-luna` was saved. The Vercel verification prompt cleared before that model update. Automatic approval review then blocked saving `VENDOR_SOURCE_IDS=all` and `OPENAI_REASONING_EFFORT=none`, stating that paid model activation and provider spending require explicit approval. Those flags remain unsaved. The table above is the intended configuration, not a claim that activation is complete. Keep this PR in draft until that approval and configuration are completed. No production redeployment or database activation was performed while preparing it.

## Backfill and checks

Publisher polling reads the entries currently retained by each RSS/Atom feed. It does not apply the structured import's September 24 timestamp to publisher entries and cannot reconstruct a complete historical month from truncated feeds. Initial activation can collect older retained entries. Identical documents at the same source URL are deduplicated; changed documents and distinct publisher notices can incur new extraction calls. The shared collection queue may delay publisher collection while structured backfill drains.

After merge, verify the exact release is ready, 377 source rows are enabled, and all three scheduled routes are running. Inspect authenticated health and per-source failures. Check real Ruby and other publisher documents, source evidence, product-version associations, token usage and publication through JSON/RSS/UI. Source registration and passing code tests do not prove live coverage or extraction quality.

The [100-case manually labeled real-announcement evaluation](evaluation.md), including negative, multilingual, multi-product, withdrawal and hostile-input cases, remains outstanding. No precision/recall, live model success, full backfill completion or 24-hour observation result is claimed by this PR. This is an alpha activation requested by the operator, with those quality and launch gates still open.

## Pause or narrow extraction

Set `VENDOR_SOURCE_IDS` empty (or to a reviewed subset) and deploy the checked configuration through the Production workflow. `npm run sources:configure` previews the selection; `--apply` reconciles database enablement while preserving history and checkpoints. Disable the affected publisher source rows to pause claims immediately. Revoking the feed-specific OpenAI key is an emergency stop for that key; do not change unrelated Heist credentials. Re-enabling sources does not automatically reset previously exhausted jobs.
