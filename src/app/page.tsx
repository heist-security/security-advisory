import type { Metadata } from "next";
import { cachedEvents } from "@/lib/cached-events";
import { configured } from "@/lib/db";
import type { FeedEvent } from "@/lib/events";
import {
  eventTypes,
  filterQuery,
  pageParams,
  parseEventQuery,
  type EventQuery,
  type Filters,
  type SearchParams,
} from "@/lib/filters";
import { feedLink, groupEvents, dayLabel, typeLabels } from "@/lib/feed-view";
import { registry } from "@/lib/registry";
import { EventCard } from "@/components/event-card";
import { SearchIcon } from "@/components/icons";
export const metadata: Metadata = {
  title: "Security feed",
  description:
    "Browse security advisories, patches and mitigations in one open feed. Search by technology, CVE or source and inspect the evidence.",
};
const sources = [...registry].sort((a, b) => a.name.localeCompare(b.name));
const filterNames = {
  q: "Search",
  type: "Type",
  technology: "Technology",
  cve: "CVE",
  source: "Source",
};
export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let query: EventQuery = { limit: 20 },
    error = "",
    unavailable = !configured();
  try {
    query = parseEventQuery(pageParams(await searchParams), 20);
    if (query.after !== undefined)
      throw new Error("Use the JSON API for incremental cursors");
    query.limit = Math.min(query.limit, 50);
  } catch (cause) {
    error = (cause as Error).message;
  }
  let rows: FeedEvent[] = [],
    hasMore = false;
  if (!unavailable && !error) {
    try {
      const result = await cachedEvents({ ...query, limit: query.limit + 1 });
      hasMore = result.length > query.limit;
      rows = result.slice(0, query.limit);
    } catch {
      unavailable = true;
    }
  }
  const filters = filterQuery(query),
    suffix = filters.size ? "?" + filters : "";
  const active = [...filters.entries()];
  const groups = groupEvents(rows);
  const latest = feedLink(query);
  const resetFilter = (key: string) => {
    const next = { ...query };
    delete next[key as keyof Filters];
    return feedLink(next);
  };
  return (
    <main id="main" className="container browser-feed">
      <section className="browser-heading">
        <h1>Security feed</h1>
        <nav className="format-links" aria-label="Feed formats">
          <a href={"/feed.xml" + suffix}>
            RSS
          </a>
          <a href={"/api/v1/events" + suffix}>
            JSON
          </a>
        </nav>
      </section>
      <div className="browser-layout">
        <section className="feed-controls" aria-label="Feed controls">
          <form className="feed-search" action="/" role="search">
            {[...filters]
              .filter(([key]) => key !== "q")
              .map(([key, value]) => (
                <input key={key} type="hidden" name={key} value={value} />
              ))}
            <label className="sr-only" htmlFor="feed-search">
              Search announcements
            </label>
            <SearchIcon />
            <input
              id="feed-search"
              name="q"
              type="search"
              maxLength={120}
              placeholder="Search announcements, products, CVEs…"
              defaultValue={query.q ?? ""}
            />
            <button type="submit">Search</button>
          </form>
          <nav className="type-navigation" aria-label="Event types">
            <a
              href={feedLink({ ...query, type: undefined })}
              aria-current={!query.type ? "page" : undefined}
            >
              All events
            </a>
            {eventTypes.map((type) => (
              <a
                key={type}
                href={feedLink({ ...query, type })}
                aria-current={query.type === type ? "page" : undefined}
              >
                {typeLabels[type]}
              </a>
            ))}
          </nav>
          <details
            className="refine-panel"
            open={Boolean(query.technology || query.cve || query.source)}
          >
            <summary>
              Filters{" "}
              <span className="filter-description">
                Technology, CVE, source
              </span>
            </summary>
            <form
              action="/"
              className="refine-form"
              aria-label="Refine the feed"
            >
              {query.q ? (
                <input type="hidden" name="q" value={query.q} />
              ) : null}
              {query.type ? (
                <input type="hidden" name="type" value={query.type} />
              ) : null}
              <label>
                Technology
                <input
                  name="technology"
                  placeholder="e.g. Node.js"
                  maxLength={100}
                  defaultValue={query.technology ?? ""}
                />
              </label>
              <label>
                CVE
                <input
                  name="cve"
                  placeholder="CVE-2026-12345"
                  maxLength={28}
                  defaultValue={query.cve ?? ""}
                />
              </label>
              <label>
                Source
                <select name="source" defaultValue={query.source ?? ""}>
                  <option value="">All sources</option>
                  {query.source &&
                  !sources.some((source) => source.id === query.source) ? (
                    <option value={query.source}>{query.source}</option>
                  ) : null}
                  {sources.map((source) => (
                    <option key={source.id} value={source.id}>
                      {source.name}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="button primary">
                Apply filters
              </button>
            </form>
          </details>
        </section>
        <section className="feed-reader" aria-label="Security announcements">
          {active.length ? (
            <div className="active-filters" aria-label="Active filters">
              {active.map(([key, value]) => (
                <a
                  key={key}
                  href={resetFilter(key)}
                  aria-label={
                    "Remove " +
                    filterNames[key as keyof typeof filterNames] +
                    " filter"
                  }
                >
                  {filterNames[key as keyof typeof filterNames]}:{" "}
                  {key === "source"
                    ? (sources.find((s) => s.id === value)?.name ?? value)
                    : value}
                  <span aria-hidden="true">×</span>
                </a>
              ))}
              <a className="clear-all" href="/">
                Clear all
              </a>
            </div>
          ) : null}
          <div className="reader-toolbar">
            <div>
              <h2>
                {query.before !== undefined
                  ? "Earlier events"
                  : query.q
                    ? "Search results"
                    : query.type
                      ? typeLabels[query.type]
                      : "All security events"}
              </h2>
              <span>
                {rows.length
                  ? rows.length + " events on this page · Newest first"
                  : "Newest first"}
              </span>
            </div>
            <a
              href={latest}
              className="refresh-link"
              aria-label={
                query.before !== undefined
                  ? "Back to latest events"
                  : "Refresh feed"
              }
            >
              {query.before !== undefined ? "Latest" : "Refresh"}
            </a>
          </div>
          {error ? (
            <div className="reader-empty" role="alert">
              <h3>Check your filters</h3>
              <p>{error}.</p>
              <a className="button" href="/">
                Reset filters
              </a>
            </div>
          ) : unavailable ? (
            <div className="reader-empty" role="status">
              <h3>The feed is temporarily unavailable.</h3>
              <p>
                Please try again shortly. You can still browse the source
                catalog.
              </p>
              <div className="actions">
                <a href={latest} className="button">
                  Try again
                </a>
                <a href="/sources">Browse sources</a>
              </div>
            </div>
          ) : !rows.length ? (
            <div className="reader-empty" role="status">
              <h3>
                {active.length
                  ? "No events match these filters."
                  : query.before !== undefined
                    ? "You’ve reached the beginning."
                    : "No events published yet."}
              </h3>
              <p>
                {active.length
                  ? "Try fewer keywords, another technology, or clear your filters."
                  : query.before !== undefined
                    ? "Return to the latest announcements to keep browsing."
                    : "Announcements will appear here as sources are collected and processed."}
              </p>
              <a href={active.length ? "/" : latest} className="button">
                {active.length
                  ? "Clear filters"
                  : query.before !== undefined
                    ? "Back to latest"
                    : "Refresh feed"}
              </a>
            </div>
          ) : (
            <div className="event-timeline">
              {groups.map((group, index) => (
                <section
                  className="event-day"
                  key={group.day + "-" + index}
                  aria-labelledby={"day-" + index}
                >
                  <h2 id={"day-" + index} className="day-heading">
                    <time dateTime={group.day}>{dayLabel(group.day)}</time>
                    <span>UTC · Added to the feed</span>
                  </h2>
                  {group.events.map((event) => (
                    <EventCard
                      key={event.id}
                      event={event}
                      filters={query}
                      expanded
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
          {hasMore && rows.length ? (
            <div className="reader-pagination">
              <a
                className="button"
                href={feedLink(query, {
                  before: String(rows.at(-1)!.id),
                  limit: String(query.limit),
                })}
              >
                Older events
              </a>
            </div>
          ) : null}
          <p className="reader-footnote">
            This timeline includes revisions and corrections. Verify the latest
            source before acting. Cached results may take up to a minute to
            refresh.
          </p>
        </section>
      </div>
    </main>
  );
}
