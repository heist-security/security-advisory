import Link from "next/link";
import type { Metadata } from "next";
import { Card, CardContent } from "@/components/ui/card";
export const metadata: Metadata = { title: "API documentation" };
export default function Docs() {
  return (
    <main id="main" className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-8">
      <article className="space-y-5 text-sm leading-7 [overflow-wrap:anywhere] [&>h1]:text-3xl [&>h1]:font-semibold [&>h2]:pt-5 [&>h2]:text-xl [&>h2]:font-semibold [&>p]:text-muted-foreground [&_a]:text-primary [&_a:hover]:underline">
        <h1>API documentation</h1>
        <p>
          The <Link href="/">reader</Link>, JSON and RSS share one feed item.
          Each item lists products, affected and fixed versions, CVEs, severity
          and source evidence. Patch releases combine when the same publisher
          explicitly fixes the exact same vulnerabilities for the same products.
        </p>
        <h2>Subscribe</h2>
        <Card>
          <CardContent>
            <pre className="overflow-x-auto">
              {
                "/feed.xml\n/feed.xml?technology=containerd&type=patch\n/api/v1/items\n/api/v1/items?after=0&limit=100"
              }
            </pre>
          </CardContent>
        </Card>
        <p>
          No account or API key is required. Open an item to inspect every
          source claim and its native affected-version data. Display versions
          and technology names do not establish whether your system is affected.
        </p>
        <h2>Filters</h2>
        <p>
          Use q for text search, type for
          advisory/patch/mitigation/withdrawal/other, severity for
          critical/high/medium/low/unknown, technology for up to ten product
          families, cve for one CVE, or source for an exact{" "}
          <Link href="/sources">source ID</Link>. Type, severity and technology
          accept comma-separated choices. fix=1 selects explicit fixes;
          important=1 selects high/critical ratings, known exploitation or
          unrated fixes. Filters combine with AND.
        </p>
        <h2>JSON and cursors</h2>
        <Card>
          <CardContent>
            <pre className="overflow-x-auto">
              {
                '{\n  "schema_version": "1",\n  "data": [],\n  "next_after": 0,\n  "next_before": null\n}'
              }
            </pre>
          </CardContent>
        </Card>
        <p>
          Without after, items arrive newest first. Use next_before to browse
          older items. For synchronization start at after=0, upsert by id, and
          persist next_after after processing each batch. Remove identities with
          active=false and follow replaced_by. A current identity can have
          kind=withdrawal. Limits are 1–100. IDs are stable; cursor and revision
          change when the item changes.
        </p>
        <p>
          Only the latest item state is stored, so intermediate revisions can
          coalesce. RSS uses heist-item:ID:REVISION identifiers and a bounded
          recent window. Use JSON cursors for complete synchronization. Restart
          the cursor when changing filters. Corrections retain earlier
          structured filter matches, so a patch subscription can receive a
          withdrawal. Free-text search only matches current evidence.
        </p>
        <h2>Ratings and evidence</h2>
        <p>
          Severity and CVSS come from the current source claims in the item.
          They are not copied from other records sharing a CVE. Missing ratings
          are unknown, not zero risk. The optional{" "}
          <a href="/api/v1/risk?cve=CVE-2021-44228">risk API</a> provides dated
          EPSS, KEV and optional NVD context. Risk lookups do not change stored
          severity or create feed revisions.
        </p>
        <h2>Upgrading existing subscriptions</h2>
        <p>
          The previous /api/v1/events endpoint, raw/grouped views and old detail
          URLs have been retired. Use /api/v1/items and /items/ID, with fresh
          cursors and RSS subscriptions. Old cursors cannot be reused. There is
          one current item model; historical source revisions remain in the
          private audit archive.
        </p>
        <h2>Availability</h2>
        <p>
          Invalid filters return 400. Unavailable storage returns 503 with
          Retry-After rather than a successful empty feed. Public JSON supports
          CORS. The <a href="/api/v1/sources">source catalog</a> describes
          configured sources, not their live health.
        </p>
      </article>
    </main>
  );
}
