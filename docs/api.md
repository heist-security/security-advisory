# Consumer API

All publishers contribute to one event stream. The visual page at `/feed`, RSS and JSON expose the same events and filters; they are three representations of the same feed.

## Filters

| Parameter  | Meaning                                                  | Example        |
| ---------- | -------------------------------------------------------- | -------------- |
| q | Keyword search, up to 120 characters | authentication |
| type       | Advisory classification; kind remains a compatible alias | patch          |
| technology | Normalized product-name key, or an exact source ID       | node-js        |
| cve        | CVE identifier, case-insensitive input                   | CVE-2026-12345 |
| source     | Exact source ID from the catalog                         | ruby           |
| limit      | Number of events, 1-100                                  | 100            |
| after      | JSON only: ascending incremental cursor, exclusive       | 0              |
| before     | JSON only: newest-first pagination, exclusive            | 123            |

Different filters combine with AND. Repeated API parameters, conflicting type/kind, invalid values and simultaneous after/before produce 400. Technology input is lowercased, runs of non-ASCII-alphanumeric characters become hyphens, and edge hyphens are trimmed. For example Node.js becomes node-js, C++ becomes c-plus-plus and C# becomes c-sharp. Keys derive from evidenced product names; this is not a curated alias/ontology service. Source IDs provide a stable alternative.

## Visual browsing and keyword search

`/feed` provides a newest-first timeline, expandable evidence, active-filter links and cursor navigation. Dates use UTC and reflect when events were added to Heist Feed. It defaults to 20 events per page and caps visual pages at 50; RSS/JSON keep their existing limits. The visual page uses `before` for older results; use JSON for `after` cursors.

`q` searches words in published event text, product/version evidence, source IDs and historical subscription keys. All supplied words must match; punctuation is handled by PostgreSQL's simple text-search dictionary. It searches the event archive, not just the currently displayed page, and does not search private raw documents. Use the structured technology/CVE filters for precise subscriptions. A correction retains historical routing keys but not all previous free-text wording, so a title-specific keyword search may omit a later correction.

Examples: `/feed?q=authentication`, `/feed.xml?q=authentication&type=patch`, `/api/v1/events?q=authentication&after=0`.

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

Public event responses are cacheable for 60 seconds with a five-minute stale window. No client key is required. Hosting rate limits can return 429; honor Retry-After. Malformed requests return 400. Unavailable data returns 503 and Retry-After: 60.

The source catalog is paginated at /api/v1/sources?page=1, with 24 records per page and optional q, channel and category filters. It is the shipped catalog, not the live database enablement state or uptime. Source changes may be observed during pagination; this endpoint is not an immutable catalog snapshot API.

Fields may be added in schema_version 1. Consumers should ignore unknown fields and handle unknown future event types conservatively.
