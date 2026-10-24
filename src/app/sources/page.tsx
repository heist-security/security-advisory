import type { Metadata } from "next";
import {
  registry,
  channelCounts,
  categories,
  sourcePage,
} from "@/lib/registry";
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
    <main id="main" className="container sources-page">
      <header className="catalog-heading">
        <h1>
          Sources <span className="heading-count">{registry.length}</span>
        </h1>
        <p>
          {channelCounts["security-advisories"]} advisory ·{" "}
          {channelCounts["mixed-announcements"]} mixed ·{" "}
          {channelCounts["release-notes"]} release-note streams
        </p>
      </header>
      <form className="filters catalog-filters" action="/sources">
        <label>
          Search
          <input
            name="q"
            placeholder="Search sources…"
            defaultValue={result.q}
            maxLength={100}
          />
        </label>
        <label>
          Channel
          <select name="channel" defaultValue={result.channel}>
            <option value="">All channels</option>
            <option value="security-advisories">Advisories</option>
            <option value="mixed-announcements">Mixed announcements</option>
            <option value="release-notes">Release notes</option>
          </select>
        </label>
        <label>
          Category
          <select name="category" defaultValue={result.category}>
            <option value="">All categories</option>
            {categories.map((category) => (
              <option key={category}>{category}</option>
            ))}
          </select>
        </label>
        <button className="button" type="submit">
          Filter
        </button>
      </form>
      <div className="catalog-count">
        <p>
          {result.total} matching sources · Page {result.page} of {result.pages}
        </p>
        <a href="/sources">Reset filters</a>
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
                aria-label={"Checked document for " + source.name}
              >
                Sample
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
                  Checked{" "}
                  <time dateTime={source.verification.checked_at}>
                    {source.verification.checked_at.slice(0, 10)}
                  </time>{" "}
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
        Checks verify retrieval and parsing, not complete coverage, live uptime
        or extraction accuracy. A project may have multiple streams.
      </p>
    </main>
  );
}
