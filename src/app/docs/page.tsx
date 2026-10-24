import type { Metadata } from "next";
import { LinkIcon } from "@/components/icons";
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
          <a href="/">Open the feed</a> to search the archive, filter by your
          stack, and expand source evidence and version details.
        </p>
        <h2>Subscribe</h2>
        <pre>
          {
            "/feed.xml\n/feed.xml?technology=node-js\n/feed.xml?type=patch&technology=ruby\n/feed.xml?cve=CVE-2026-12345"
          }
        </pre>
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
              <td>Normalized product name, e.g. node-js, or a source ID</td>
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
          Filters combine with AND. Source and technology keys are available in
          event responses. Corrections retain earlier subscription keys, so an
          update can reach you even if its latest classification changes.
          Keyword searches match the current event text and retained routing
          keys; previous free-text wording is not retained.
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
          announcement. Product and version facts in the payload are supported
          by source quotations, but machine extraction can still make mistakes.
        </p>
        <h2>Delivery and limits</h2>
        <p>
          RSS contains the latest 100 matching events by default. Use JSON for
          full backfill. Public event reads are cached for 60 seconds with a
          five-minute stale window. Handle 400 for invalid input, 429 for
          hosting rate limits and 503 for unavailable data; honor Retry-After.
        </p>
        <p>
          <a href="https://github.com/heist-security/security-advisory/blob/main/docs/api.md">
            Full response example and API semantics <LinkIcon />
          </a>
        </p>
        <p>
          <a href="/sources">Source coverage</a>
        </p>
      </article>
    </main>
  );
}
