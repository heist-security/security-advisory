import type { Metadata } from "next";
import { SourceFilters } from "@/components/source-filters";
import { sourcePage } from "@/lib/registry";
import { pageParams, type SearchParams } from "@/lib/filters";
export const metadata: Metadata = { title: "Sources" };
const channelLabels = {
  "security-advisories": "Advisories",
  "mixed-announcements": "Mixed announcements",
  "release-notes": "Release notes",
};
export default async function Sources({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = pageParams(await searchParams),
    result = sourcePage(params);
  const link = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return "/sources?" + next;
  };
  return (
    <main id="main" className="site-container sources-page">
      <header className="catalog-heading">
        <h1>
          Sources <span className="heading-count">{result.catalog_count}</span>
        </h1>
        <p>
          {result.catalog_channel_counts["security-advisories"]} advisory ·{" "}
          {result.catalog_channel_counts["mixed-announcements"]} mixed ·{" "}
          {result.catalog_channel_counts["release-notes"]} release-note streams
        </p>
      </header>
      <SourceFilters
        initialFilters={{
          q: (params.get("q") ?? "").slice(0, 100),
          channel: result.channel,
          category: result.category,
          catalog: params.get("catalog") === "vendor" ? "vendor" : "",
        }}
        categories={result.catalog_categories}
      />
      <div className="catalog-count">
        <p>
          {result.total} matching sources · Page {result.page} of {result.pages}
        </p>
        {params.get("catalog") === "vendor" ? (
          <a href="/sources">Configured sources</a>
        ) : (
          <a href="/sources?catalog=vendor">Optional vendor catalog</a>
        )}
        <a
          href={
            params.get("catalog") === "vendor"
              ? "/sources?catalog=vendor"
              : "/sources"
          }
        >
          Reset filters
        </a>
      </div>
      <div className="catalog-columns" aria-hidden="true">
        <span>Source</span>
        <span>Category</span>
        <span>Channel</span>
        <span>Links</span>
        <span>Notes</span>
      </div>
      <div className="catalog-list">
        {result.rows.map((source) => (
          <article className="source-row" key={source.id}>
            <h2>
              <a href={source.homepage}>{source.name}</a>
            </h2>
            <span className="source-category">{source.category}</span>
            <span className="source-channel">
              {channelLabels[source.channel]}
            </span>
            <div className="source-links">
              <a
                href={source.feed_url}
                aria-label={"Publisher feed for " + source.name}
              >
                Feed
              </a>
              <a
                href={source.verification.sample_url}
                aria-label={
                  (source.verification.checked_at
                    ? "Checked document for "
                    : "Data documentation for ") + source.name
                }
              >
                {source.verification.checked_at ? "Sample" : "Docs"}
              </a>
              <a href={"/?source=" + encodeURIComponent(source.id)}>Events</a>
            </div>
            <details className="source-notes">
              <summary
                aria-label={"Scope and verification notes for " + source.name}
              >
                Details
              </summary>
              <div>
                <p className="source-check">
                  {source.verification.checked_at ? (
                    <>
                      Checked{" "}
                      <time dateTime={source.verification.checked_at}>
                        {source.verification.checked_at.slice(0, 10)}
                      </time>
                    </>
                  ) : (
                    "Structured adapter"
                  )}{" "}
                  · Target interval {source.poll_interval_minutes} minutes
                </p>
                <p>{source.rationale}</p>
                <p>{source.limitations}</p>
                {source.verification.warnings.length ? (
                  <p>{source.verification.warnings.join("; ")}</p>
                ) : null}
              </div>
            </details>
          </article>
        ))}
      </div>
      {!result.total ? (
        <p className="catalog-empty">No sources match these filters.</p>
      ) : null}
      <nav className="pagination" aria-label="Source pages">
        {result.page > 1 ? (
          <a className="button" href={link(result.page - 1)}>
            Previous
          </a>
        ) : (
          <span />
        )}
        {result.page < result.pages ? (
          <a className="button" href={link(result.page + 1)}>
            Next
          </a>
        ) : null}
      </nav>
      <p className="catalog-note">
        Structured advisory databases are configured by default; vendor feeds
        are opt-in. Catalog entries do not establish live uptime or complete
        coverage. Vendor checks verify retrieval and parsing, not extraction
        accuracy.
      </p>
    </main>
  );
}
