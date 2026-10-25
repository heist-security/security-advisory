# Consumer API

All publishers contribute to one event stream. The visual page at `/`, RSS and JSON expose the same events and filters; they are three representations of the same feed.

## Filters

| Parameter  | Meaning                                                     | Example        |
| ---------- | ----------------------------------------------------------- | -------------- |
| q          | Keyword search, up to 120 characters                        | authentication |
| type       | Advisory classification; kind remains a compatible alias    | patch          |
| technology | Up to 10 catalog IDs or legacy routing keys (OR)            | node-js        |
| cve        | CVE identifier, case-insensitive input                      | CVE-2026-12345 |
| source     | Exact source ID from the catalog                            | ruby           |
| severity   | One or more publisher/linked severity ratings               | critical,high  |
| important  | High/Critical OR known exploited OR unrated security fix    | 1              |
| fix        | Documented fixed versions (including structured advisories) | 1              |
| limit      | Number of events, 1-100                                     | 100            |
| after      | JSON only: ascending incremental cursor, exclusive          | 0              |
| before     | JSON only: newest-first pagination, exclusive               | 123            |

Different filters combine with AND. Repeated API parameters, conflicting type/kind, invalid values and simultaneous after/before produce 400. Technology input is lowercased, runs of non-ASCII-alphanumeric characters become hyphens, and edge hyphens are trimmed. For example Node.js becomes node-js, C++ becomes c-plus-plus and C# becomes c-sharp. Keys derive from evidenced product names; this is not a curated alias/ontology service. Source IDs provide a stable alternative.

## Visual browsing and keyword search

`/` provides a newest-first timeline, expandable evidence, active-filter links and cursor navigation. Dates use UTC and reflect when events were added to Heist Feed. It defaults to 20 events per page and caps visual pages at 50; RSS/JSON keep their existing limits. Existing `/feed` URLs redirect to `/` and preserve query parameters. The visual page uses `before` for older results; use JSON for `after` cursors.

`q` searches words in published event text, product/version evidence, source IDs and historical subscription keys. All supplied words must match; punctuation is handled by PostgreSQL's simple text-search dictionary. It searches the event archive, not just the currently displayed page, and does not search private raw documents. Use the structured technology/CVE filters for precise subscriptions. A correction retains historical routing keys but not all previous free-text wording, so a title-specific keyword search may omit a later correction.

Examples: `/?q=authentication`, `/feed.xml?q=authentication&type=patch`, `/api/v1/events?q=authentication&after=0`.

## Incremental consumption

Start at /api/v1/events?after=0&limit=100. Persist next_after only after processing the returned batch. Repeat with the same filters. Empty batches preserve the cursor. IDs can have gaps. Changing filters requires a new cursor to backfill the new subscription.

Without after, the latest events are returned newest first. Use next_before to browse older results. This snapshot mode is not a complete backfill.

RSS returns the latest 100 matching events by default. GUIDs identify revisions. Use JSON for reliable backfill and catch-up after a long outage.

## Example

This event is illustrative, not live publisher data:

    {
      "schema_version": "1",
      "data": [{
        "id": 42,
        "advisory_id": "f5c8823b-ffea-46a7-81eb-bec35cda329b",
        "revision": 1,
        "source_id": "example",
        "source_url": "https://example.org/security/widget-2",
        "source_published_at": "2026-10-20T10:00:00Z",
        "published_at": "2026-10-20T10:05:00Z",
        "extraction_method": "llm",
        "technologies": ["example", "widget"],
        "cve_ids": [],
        "event_types": ["patch"],
        "payload": {
          "security_relevant": true,
          "kind": "patch",
          "title": "Widget security update",
          "summary": "Widget 2.0 fixes a security issue.",
          "evidence": "Widget security update. Fixed in 2.0.",
          "products": [{
            "name": {"value": "Widget", "evidence": "Widget security update."},
            "affected_versions": [],
            "fixed_versions": [{"value": "2.0", "evidence": "Fixed in 2.0."}],
            "prerequisites": []
          }],
          "related_cves": [],
          "severity": "unknown",
          "severity_evidence": null
        }
      }],
      "next_after": 42,
      "next_before": 42
    }

Unknown fields remain empty or unknown. Never interpret version strings as semver constraints without a separate ecosystem-aware parser.

## Corrections and subscription continuity

technologies, cve_ids and event_types are subscription routing indexes. They accumulate prior keys for the advisory so corrections still reach consumers of an earlier revision. They do not assert that every historical product, CVE or type applies to the newest payload.

Use payload for the current extracted claims. A type=patch subscription can contain a subsequent withdrawal or advisory revision.

When a newer document is classified as non-security after a published event, extraction_method is system, payload.kind is withdrawal, correction_reason is reclassified_non_security, and supersedes_event_id identifies the preceding event. Products/evidence are empty instead of borrowing quotations from an outdated document. This corrects Heist's extraction; it is not a publisher retraction.

## Caching, errors and source catalog

Public event responses use `Cache-Control: no-store`; each request reads the database. No client key is required. Hosting rate limits can return 429; honor Retry-After. Malformed requests return 400. Unavailable data returns 503 and Retry-After: 60.

The source catalog is paginated at /api/v1/sources?page=1, with 24 records per page and optional q, channel and category filters. It is the shipped catalog, not the live database enablement state or uptime. Source changes may be observed during pagination; this endpoint is not an immutable catalog snapshot API.

Fields may be added in schema_version 1. Consumers should ignore unknown fields and handle unknown future event types conservatively.

## Structured advisories and risk context

Events from `core-osv`, `core-cve` and `core-kev` expose `extraction_method: "structured"` and `payload.structured` with upstream identity, aliases, native affected data and provenance. Their evidence fields are record identifiers/JSON pointers. Use native affected data for package/version matching; display technology tags alone do not establish exposure. Source records sharing a CVE remain separate attributable events.

`GET /api/v1/risk?cve=CVE-2021-44228` returns KEV membership details and dated EPSS probability/percentile with explicit provider availability. Supply up to 40 comma-separated CVEs. Optional `nvd=1` adds NVD metrics/configurations for exactly one CVE. Null means no returned record or unavailable data, not zero risk. Results can be cached for 15 minutes; enrichment outages never block the event feed. See [semantics, checkpoints and limits](structured-sources.md).

The source catalog defaults to core and opted-in vendor sources. `catalog=vendor` lists the historical vendor catalog for selection; it is not a live list of enabled database rows.

## Severity and patch relationships

`severity=critical,high` matches any selected severity; valid values are `critical`, `high`, `medium`, `low`, `unknown` (displayed as Unrated). Values are canonicalized and deduplicated. `important=1` and `fix=1` are independent filters and combine with other filters using AND. Adding a severity to Important updates narrows the preset and can exclude unrated fixes. All filtering happens in PostgreSQL before pagination.

Every event includes a `priority` snapshot with `severity` (the highest publisher or linked CVE rating), `publisher_severity`, `linked_cves`, `fix_available`, `known_exploited` and `reasons`. `payload.severity` remains the publisher's original rating. Each linked rating preserves its CVE, source URL, affected product names, native metrics and relationship evidence. Conflicting current provider ratings are retained; the highest is used for filtering. Latest provider revisions are used, withdrawn records are excluded, and a rejected CVE cannot acquire severity through an older OSV record. KEV absence is not proof of no exploitation.

A publisher's `related_cves` alone never establishes remediation. New extractions provide `fixed_cves` with a product and exact remediation quotation. The product must have an evidenced fixed version; mention-only, negated, future or unsupported relationships are rejected. The deterministic guard currently recognizes English remediation wording; otherwise a patch remains eligible as an unrated security fix. Structured CVE/OSV identities and aliases establish their own advisory relationships.

Historical publisher patches are linked only when their extracted title is a verbatim opening source heading that explicitly names CVE fixes and the record has documented fixed versions. Mere mentions and later related-article headlines do not qualify. This conservative backfill covers the original Ruby/GitLab fix announcement without assigning every Ruby release the GitLab rating. Other historical records may remain unrated until a future source extraction supplies explicit relationship evidence. No paid re-extraction is queued by this migration.

A Ruby patch linked to a Critical GitLab vulnerability is labelled **Linked Critical CVE**; this does not assert Ruby itself or every Ruby application has the same CVSS score. Native CVSS metrics stay attached to the originating product/record, not combined into a new score.

Changes to linked severity, exploitation or displayed evidence append a context-only event with `context_update: true`, a new ID, revision and RSS GUID. It preserves the source announcement and original date; it does not consume a model attempt or pretend a new release was published. Unchanged context does not emit duplicates. Consumers should replace the previous revision for the same `advisory_id`. Initial migration enrichment does not replay historical notifications; existing consumers wanting the newly introduced filters must start a fresh backfill.

Severity, important and fix routing retain prior subscription matches so downgrades and withdrawals reach existing subscribers. Thus a Critical subscription may receive a later Low revision or withdrawal; `priority` describes that revision's actual classification. Publisher dates appear on cards separately from feed publication dates so backfilled releases are not presented as newly announced fixes.

### Technology multi-select

`technology=node-js,ruby` matches any selected technology family. It combines with search, type, severity and other filters using AND, before pagination. Known aliases and numeric versions normalize to the same family: `node`, `nodejs`, `Node.js 8` and `Node.js 22` become `node-js`; `CPython` and `python3` become `python`. Legacy alias/version URLs therefore include all matching family records. Distinct packages such as `node-gyp`, `Node-RED`, `python-pillow` and `react-dom` remain separate. Unknown technologies retain their normalized exact key. Values are deduplicated and sorted; each must be at most 100 characters. Repeated `technology` parameters are rejected.

The visual feed exposes Search, Type, Severity and a searchable technology multi-select. RSS, JSON and pagination retain those selections. Advanced URL/API filters remain supported; submitting the visual form replaces advanced filters not represented by its controls.

`GET /api/v1/technologies?q=node` returns up to 50 `{value,label}` choices. Use the returned stable `value` as the technology filter. The picker also accepts explicit legacy product keys when suggestions are unavailable. No raw documents or credentials are exposed.

### Technology catalog and stable subscriptions

Technology suggestions now query `technology_catalog`, a database catalog of all observed products, rather than sampling 100 recent events. The endpoint returns up to 50 alphabetically ordered matches from an indexed full-catalog search. Event volume and recency do not determine whether a technology can be found. Source IDs are not suggestions unless an actual product has that name.

Publisher product names use generic, conservative version separation before identity normalization: `Example Engine 1.2`, `Example Engine v3.4`, and future versions share `example-engine`. This works for previously unseen products without adding them to the reviewed semantic-alias list. Embedded numbers such as `log4j2`, `HTTP/2`, and `OAuth2` remain intact. Semantic synonyms cannot safely be guessed: reviewed aliases still handle names such as Node.js/nodejs; unrecognized synonyms remain separate until a rule is reviewed.

OSV package identities use the exact ecosystem and package name, including namespace and numeric suffixes. These have stable opaque `pkg-…` IDs and labels such as `widget-2 (npm)`; similarly named packages in different ecosystems remain separate. Use the returned option `value` in subscriptions, not a slug made from its label. Original affected/fixed versions and evidence are unchanged. Older routing-key subscriptions remain accepted alongside canonical IDs.

Migration 011 creates the catalog and indexed `events.technology_ids`; a publication trigger maintains them for future events. The release runner completes a separate, resumable 100-row historical metadata backfill after schema commit and before deployment. It retains previous product identities on correction events, creates no new events, and makes no model calls. Retry resumes from the committed checkpoint. Catalog reads and maintenance are service-role only. New semantic-alias rules require a versioned migration/reindex of affected metadata; do not edit applied migration snapshots.
