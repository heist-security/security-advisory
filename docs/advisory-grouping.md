# Advisory grouping

The website defaults to one card per advisory group. The JSON and RSS links on that page request the same groups using `view=grouped`.

## Endpoints and compatibility

- `/api/v1/events?view=grouped` returns the latest state of each group. Filters match source records before group pagination.
- `/api/v1/events?view=grouped&after=0` enumerates immutable group updates, oldest first. Persist `next_after` and keep `view=grouped` on subsequent requests.
- `/feed.xml?view=grouped` publishes recent group updates. GUIDs use `heist-group-update:<id>`; meaningful changes receive new GUIDs.
- `/?view=events` and JSON/RSS URLs without `view=grouped` retain the original source-event behavior and cursor/GUID namespace.

Grouped JSON uses `schema_version: "2"` and `view: "grouped"`. Top-level `id` and `published_at` identify a **group update**. Other event fields describe the selected primary source. `group.primary_event_id` identifies that source event; `group.members` contains source events with their original IDs, revisions, timestamps, payloads and ratings. `group.changed` identifies the source that prompted the update. Group revisions live in `group.revision`; top-level `revision` remains the primary source's revision.

Group cursors and raw event cursors are separate namespaces. Start at zero when switching views; never reuse an existing cursor across views. Without `after`, grouped JSON is a current-state snapshot; use `after=0` for complete grouped update history. RSS contains updates, so successive meaningful changes to a group can appear more than once. Initial grouping backfill creates historical baselines, not a replay of every source revision.

Raw events gain an additive `group_id`. `group=<id>` filters either view. The detail page lists original source revisions for the group's current membership. Membership is derived metadata and can change after an identity correction; original event IDs and payloads remain intact.

## Identity and presentation

The first grouping rule recognizes OSV mirrors anchored to a reviewed GHSA. A candidate must explicitly reference and alias that single GHSA, share an exact ecosystem/package with matching native ranges or versions, and have no conflicting shared package ranges. An explicit version list or bounded affected range is required. Titles, CVE mentions, related URLs, and unknown ranges alone never establish a group. Different ecosystems, differing fixes, independent advisories, publisher releases and KEV announcements remain distinct. Grouping makes no model calls or additional upstream requests.

The primary source is selected deterministically: active before withdrawn, reviewed before unreviewed, then publication date and advisory ID. All fixes, versions and ratings remain attached to their originating records. Filters combine on the same member; a matching member includes the entire group even if the primary itself did not match. Historical routing keys still deliver corrections and downgrades.

## Updates and corrections

A newly imported matching mirror adds attribution without another announcement. Changes to an existing source's payload, withdrawals, reversions, or effective severity/exploitation/fix context append updates. Changes only to OSV modification timestamps, expanded aliases or reference lists do not notify. Context revisions from multiple mirrors in one publication transaction are coalesced. Current snapshots include newly added sources; historical update snapshots retain their original membership.

When late identity evidence merges provisional groups, the old group's update has `change: "membership"` and `superseded_by` containing replacement group IDs. It disappears from current browsing but stays in incremental history so consumers can reconcile their groups. Divergent affected ranges split sources into separate groups and emit updates. A source withdrawal remains visible within its established group; it does not assert every source withdrew the vulnerability.

## Deployment

Migration `202610250012_advisory_groups.sql` adds the private grouping tables, queries and publication trigger. The release runner drains `backfill_advisory_groups(100)` in resumable transactions after priority and technology backfills and before deployment. It creates historical baselines without changing raw IDs, payloads, revisions or dates. Group metadata on raw events is updated. Interrupted runs resume from their committed checkpoint. Existing installations using a manual deployment must also finish this backfill before enabling grouped reads.

## List and detail pages

The feed list contains a short summary and a bounded set of technology/CVE tags. It has no inline evidence panels. Group titles open `/advisories/<encoded-group-id>`, which shows all current source records, their individual versions and ratings, native affected data, and a paginated revision history. Each historical revision opens `/events/<event-id>`. These source-event pages retain the exact published revision and link to the current advisory.

JSON records include a relative `detail_url`; grouped RSS item links point to the stable advisory page. Existing raw RSS links still point to the original publisher. Original-source links remain available on every detail page. A group URL that has been replaced redirects to its current replacement when there is exactly one, or lists the replacement groups otherwise. Unknown items return 404; database errors display an unavailable state rather than pretending the item is missing.

Opening a detail page from the list preserves the current filters and pagination in its “Back to feed” link. Only local feed URLs are accepted as return destinations.
