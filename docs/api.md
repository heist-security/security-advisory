# Feed API

The website, `/api/v1/items` and `/feed.xml` use one canonical feed item. Public reads require no API key. Data responses use CORS; item JSON/RSS use `Cache-Control: no-store`. Unavailable storage returns 503 with `Retry-After: 60`; it is never represented as an empty successful feed.

## Items

```text
GET /api/v1/items?technology=containerd&type=patch
GET /api/v1/items?after=0&limit=100
```

Responses contain `schema_version: "1"`, `data`, `next_after` and `next_before`. Each item has:

| Fields                                                              | Meaning                                                                                 |
| ------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `id`, `revision`, `cursor`                                          | Stable SHA-256 identity, meaningful revision number, latest change sequence             |
| `created_at`, `updated_at`, `source_published_at`                   | Feed timestamps and the selected source's original publication date                     |
| `active`, `replaced_by`                                             | Whether this identity is current; replacement IDs after regrouping                      |
| `kind`, `title`, `summary`                                          | Advisory, patch, mitigation, withdrawal or other                                        |
| `product_names`, `affected_versions`, `fixed_versions`              | Flat display values; inspect source records for product/version associations            |
| `cve_ids`, `fixed_cve_ids`                                          | Current related CVEs and explicitly confirmed fixed CVEs                                |
| `technology_ids`, `source_ids`, `source_urls`                       | Direct filter and provenance fields                                                     |
| `severity`, `cvss`, `known_exploited`, `fix_available`, `important` | Facts derived only from this item's current source records                              |
| `records`                                                           | Source claims with original evidence, native package/range data and document references |

Open `/items/{id}` to inspect all source claims. Native range semantics remain in `records[].payload.structured.affected`; display fields are not proof an asset is vulnerable. Missing ratings are `unknown`/null, not zero. `important` means high/critical severity, known exploitation, or an unrated item with an explicit fix.

## Filters

| Parameter              | Accepted value                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------- |
| `q`                    | 1–120 printable characters; full-text search of current title, summary and source claims |
| `type`                 | Comma-separated advisory, patch, mitigation, withdrawal, other; `kind` is an alias       |
| `severity`             | Comma-separated critical, high, medium, low, unknown                                     |
| `technology`           | Up to ten comma-separated product families; matches any selected family                  |
| `cve`                  | One CVE ID                                                                               |
| `source`               | One exact source ID from `/api/v1/sources`                                               |
| `fix=1`, `important=1` | Explicit fixed versions; important items                                                 |
| `limit`                | 1–100; default 30 JSON, 100 RSS                                                          |
| `before`, `after`      | Nonnegative safe-integer change cursors; mutually exclusive; JSON only                   |

Filters combine with AND; choices within type, severity and technology combine with OR. Repeated filter parameters and invalid values return 400. `view` and `group` are rejected: there is only one item model. `/api/v1/technologies?q=...` suggests observed technology families. The source catalog is configuration, not live source health.

## Pagination and corrections

Without `after`, JSON returns current identities newest first, including current withdrawals. Use `next_before` for older pages. Updates can move an item between browse pages; browsing is not a frozen snapshot.

For incremental synchronization start at `after=0`. Process returned items in cursor order, upsert by stable `id`, remove identities with `active=false`, and persist `next_after` only after processing the batch. Empty batches preserve the cursor. Repeat with identical filters. Changed filters require a fresh cursor. Revisions can be skipped: only the latest state of each item is stored. Retired identities remain available so an offline client can discover replacements.

Change polling and RSS retain earlier type/severity/CVE/technology/source/fix/importance matches. A patch subscription can therefore receive a withdrawal, or a critical subscription a downgraded item. Inspect the returned current fields. Search terms do not retain historical matches; use unfiltered change polling for a complete local mirror.

RSS contains recent changed item states, including correction and replacement notices, with GUID `heist-item:{id}:{revision}`. Multiple intermediate revisions between polls can coalesce. RSS is a bounded recent window, so use JSON cursors for reliable synchronization.

## Upgrade from the previous API

This release intentionally removes `/api/v1/events`, raw/grouped views, immutable group-update history, and `/events/{id}` and `/advisories/{id}` detail URLs. Use `/api/v1/items` and `/items/{id}`. Start fresh cursors and RSS subscriptions; old IDs and cursors cannot be reused. `/api/v1/items` has its own schema version 1 because it is a new resource. Earlier source history remains privately archived, not exposed as a competing public model.

## Risk context

`/api/v1/risk?cve=CVE-2021-44228` accepts 1–40 CVEs. `nvd=1` accepts one CVE. Provider availability is explicit; missing data is null, partial results are allowed, and total failure returns 503. EPSS is dated global exploitation likelihood, not customer exposure. KEV absence does not prove no exploitation. Risk lookups do not alter stored item severity or create daily feed revisions.
