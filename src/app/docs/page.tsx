import type { Metadata } from "next";
export const metadata: Metadata = { title: "API documentation" };
export default function Docs() {
  return (
    <main id="main" className="container">
      <article className="prose">
        <h1>API documentation</h1>
        <p>
          All sources publish into one feed, available visually, as RSS, or as
          JSON. Follow everything, or narrow your subscription with optional
          filters. No account or API key is required.
        </p>
        <h2>Browse visually</h2>
        <p>
          <a href="/">Open the feed</a> to search announcements and filter by
          type, severity and one or more technologies. Technology search covers
          the full observed product catalog. Release versions share a product
          choice; packages retain their ecosystem and namespace. Open each
          announcement for its source records, affected versions, evidence and
          revision history.
        </p>
        <h2>Subscribe</h2>
        <p>
          The visual feed combines confirmed copies of the same advisory. Use
          view=grouped for the same groups in JSON and RSS. Each group preserves
          its source records and their individual fixes and ratings.
        </p>
        <pre>
          {
            "/feed.xml?view=grouped\n/feed.xml?view=grouped&technology=node-js\n/api/v1/events?view=grouped\n/api/v1/events?view=grouped&after=0"
          }
        </pre>
        <p>
          Grouped JSON returns current groups by default; after=0 starts its
          update history. RSS publishes meaningful group updates, including
          source withdrawals. Matching copies add attribution without repeating
          the announcement. JSON includes the original events in group.members.
          Grouped responses use schema_version 2 and separate cursor and RSS
          GUID namespaces. Existing subscriptions without view=grouped keep
          their original behavior; start a fresh cursor when switching views.
        </p>
        <h2>Filter the shared stream</h2>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Meaning</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>q</td>
              <td>
                Search published text and subscription keys; up to 120
                characters
              </td>
            </tr>
            <tr>
              <td>type</td>
              <td>advisory, patch, mitigation, withdrawal or other</td>
            </tr>
            <tr>
              <td>technology</td>
              <td>
                Up to 10 comma-separated product keys or source IDs, e.g.
                node-js,ruby (matches any)
              </td>
            </tr>
            <tr>
              <td>cve</td>
              <td>A CVE identifier</td>
            </tr>
            <tr>
              <td>source</td>
              <td>Exact ID from the source catalog</td>
            </tr>
            <tr>
              <td>limit</td>
              <td>1–100 events</td>
            </tr>
          </tbody>
        </table>
        <p>
          Filters combine with AND. Source and legacy technology keys are
          available in event responses. Corrections retain earlier subscription
          keys, so an update can reach you even if its latest classification
          changes. Keyword searches match the current event text and retained
          routing keys; previous free-text wording is not retained.
        </p>
        <h2 id="priority">Severity and important updates</h2>
        <p>
          Use severity=critical,high to select one or more ratings (critical,
          high, medium, low, unknown). The filter uses the highest publisher or
          evidence-linked CVE rating. Linked ratings remain attributed to their
          original products; a GitLab rating does not automatically describe
          every application using Ruby.
        </p>
        <p>
          important=1 includes High/Critical ratings, known exploited CVEs and
          unrated security fixes. fix=1 selects records with documented fixed
          versions, including structured advisories. Filters combine with AND;
          selecting a severity alongside Important updates narrows that preset
          and can exclude unrated fixes.
        </p>
        <p>
          References alone do not establish a fix: publisher patches need
          explicit source evidence. Older records are linked only when a
          verbatim opening heading explicitly identifies the CVE fixes. Missing
          links or ratings remain unknown. Announced dates show the age of a
          release independently of when it entered the feed.
        </p>
        <p>
          When linked ratings or exploitation context change, a new event is
          emitted with context_update=true. Publisher content and severity
          remain unchanged. Corrections retain prior severity, Important updates
          and Fix available subscription keys, so downgrades and withdrawals
          still reach existing subscribers. Inspect priority for the current
          classification of each revision.
        </p>
        <h2>Read the JSON archive</h2>
        <pre>
          {
            '/api/v1/events?after=0&limit=100\n\n{\n  "schema_version": "1",\n  "data": [],\n  "next_after": 0,\n  "next_before": null\n}'
          }
        </pre>
        <p>
          Process each batch, save next_after, and continue with that cursor and
          the same filters. Empty batches preserve your cursor. IDs can have
          gaps. Start a new backfill when changing filters. Without after,
          results are newest first; use next_before to browse older events.
        </p>
        <h2>Understand revisions</h2>
        <p>
          advisory_id identifies a source announcement. Each revision has a new
          event ID and RSS GUID. A system withdrawal corrects an earlier Heist
          extraction; it does not imply the publisher retracted the
          announcement. Structured imports retain native affected-version data
          and upstream identifiers; optional vendor extraction includes source
          quotations. Both require checking the original source and the actual
          deployed configuration.
        </p>
        <h2>Exploitation context</h2>
        <p>
          Use /api/v1/risk?cve=CVE-2021-44228 for CISA KEV details and dated
          EPSS probability. Up to 40 CVEs can be comma-separated. Add nvd=1 for
          one CVE to include NVD metadata. Missing or unavailable data is not
          zero risk.
        </p>
        <h2>Delivery and limits</h2>
        <p>
          RSS contains the latest 100 matching events by default. Use JSON for
          full backfill. Public event reads use no-store and are fetched from
          the database for each request. Handle 400 for invalid input, 429 for
          hosting rate limits and 503 for unavailable data; honor Retry-After.
        </p>
        <p>
          <a href="https://github.com/heist-security/security-advisory/blob/main/docs/api.md">
            Full response example and API semantics
          </a>
        </p>
        <p>
          <a href="/sources">Source coverage</a>
        </p>
      </article>
    </main>
  );
}
