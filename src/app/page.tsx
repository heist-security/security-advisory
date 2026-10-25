import type { Metadata } from "next";
import { events } from "@/lib/events";
import { configured } from "@/lib/db";
import type { FeedEvent } from "@/lib/events";
import {
  eventTypes,
  filterQuery,
  pageParams,
  parseEventQuery,
  type EventQuery,
  type SearchParams,
} from "@/lib/filters";
import { feedLink, groupEvents, dayLabel, typeLabels } from "@/lib/feed-view";
import { registry } from "@/lib/registry";
import { EventCard } from "@/components/event-card";
import { SeverityFilter } from "@/components/severity-filter";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Security feed",
  description:
    "Browse security advisories, patches and mitigations in one open feed. Search by technology, CVE or source and inspect the evidence.",
};
const sources = [...registry].sort((a, b) => a.name.localeCompare(b.name));
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
      const result = await events({ ...query, limit: query.limit + 1 });
      hasMore = result.length > query.limit;
      rows = result.slice(0, query.limit);
    } catch {
      unavailable = true;
    }
  }
  const filters = filterQuery(query),
    suffix = filters.size ? "?" + filters : "";
  const groups = groupEvents(rows);
  const latest = feedLink(query);
  return (
    <main id="main" className="container browser-feed">
      <section className="browser-heading">
        <h1>Security feed</h1>
        <nav className="format-links" aria-label="Feed formats">
          <a href={"/feed.xml" + suffix}>RSS</a>
          <a href={"/api/v1/events" + suffix}>JSON</a>
        </nav>
      </section>
      <form
        className="filters feed-filters"
        action="/"
        role="search"
        aria-label="Filter the feed"
      >
        <label>
          Search
          <input
            name="q"
            type="search"
            maxLength={120}
            placeholder="Search announcements…"
            defaultValue={query.q ?? ""}
          />
        </label>
        <label>
          Type
          <select name="type" defaultValue={query.type ?? ""}>
            <option value="">All types</option>
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {typeLabels[type]}
              </option>
            ))}
          </select>
        </label>
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
        <div className="filter-actions">
          <button type="submit" className="button">
            Filter
          </button>
          {filters.size > 0 && !error ? <a href="/">Reset filters</a> : null}
        </div>
        <div className="priority-filters">
          <SeverityFilter
            key={query.severity?.join(",") ?? "all"}
            selected={query.severity}
          />
          <label>
            <input
              type="checkbox"
              name="important"
              value="1"
              defaultChecked={!!query.important}
            />
            Important updates
          </label>
          <label>
            <input
              type="checkbox"
              name="fix"
              value="1"
              defaultChecked={!!query.fix}
            />
            Fix available
          </label>
          <a href="/docs#priority">How priority works</a>
        </div>
      </form>
      <section className="feed-reader" aria-label="Security announcements">
        {query.before !== undefined && rows.length > 0 ? (
          <a href={latest} className="latest-link">
            Back to latest events
          </a>
        ) : null}
        {error ? (
          <p className="reader-empty" role="alert">
            {error}. <a href="/">Reset filters</a>
          </p>
        ) : unavailable ? (
          <p className="reader-empty" role="status">
            Feed temporarily unavailable. <a href={latest}>Try again</a>
          </p>
        ) : !rows.length ? (
          <p className="reader-empty" role="status">
            {query.before !== undefined ? (
              <>
                No earlier events. <a href={latest}>Back to latest events</a>
              </>
            ) : filters.size ? (
              "No events match your filters."
            ) : (
              "No events yet."
            )}
          </p>
        ) : (
          <div className="event-timeline">
            {groups.map((group, index) => (
              <section
                className="event-day"
                key={group.day + "-" + index}
                aria-labelledby={"day-" + index}
              >
                <h2 id={"day-" + index} className="day-heading">
                  <time
                    dateTime={group.day}
                    title="Date added to the feed (UTC)"
                  >
                    {dayLabel(group.day)}
                  </time>
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
      </section>
    </main>
  );
}
