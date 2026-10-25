import type { Metadata } from "next";
import { events } from "@/lib/events";
import { configured } from "@/lib/db";
import type { FeedEvent } from "@/lib/events";
import {
  filterQuery,
  pageParams,
  parseEventQuery,
  type EventQuery,
  type SearchParams,
} from "@/lib/filters";
import { feedLink, groupEvents, dayLabel } from "@/lib/feed-view";
import { FeedFilters } from "@/components/feed-filters";
import { catalogOptions } from "@/lib/technology-catalog";
import { EventCard } from "@/components/event-card";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Security feed",
  description:
    "Browse security advisories, patches and mitigations in one open feed. Search by technology, CVE or source and inspect the evidence.",
};
export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = pageParams(await searchParams);
  let query: EventQuery = { limit: 20 },
    error = "",
    unavailable = !configured();
  try {
    query = parseEventQuery(params, 20);
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
  const technologies =
    !unavailable && !error
      ? await catalogOptions("", query.technology?.split(",")).catch(() => [])
      : [];
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
      <FeedFilters
        initialFilters={{ ...query, q: params.get("q") ?? "" }}
        technologies={technologies}
      />
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
