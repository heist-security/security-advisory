import Link from "next/link";
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
import { ScoreProvider } from "@/components/score-badges";
import { scoreCves } from "@/lib/advisory-scores";
import { ArrowDown, ArrowLeft, Braces, Rss } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    query.view ??= "grouped";
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
  const hasFilters = [...filters.keys()].some((key) => key !== "view");
  const groups = groupEvents(rows);
  const latest = feedLink(query);
  const returnTo = feedLink(query, {
    ...(query.before !== undefined ? { before: String(query.before) } : {}),
    limit: String(query.limit),
  });
  return (
    <main id="main" className="mx-auto w-full max-w-7xl px-4 sm:px-8">
      <section className="flex items-center justify-between gap-4 py-6">
        <h1 className="text-2xl font-semibold tracking-tight">Security feed</h1>
        <nav className="flex items-center gap-2" aria-label="Feed formats">
          <Button asChild variant="outline" size="sm">
            <a href={"/feed.xml" + suffix}>
              <Rss aria-hidden="true" />
              RSS
            </a>
          </Button>
          <Button asChild variant="outline" size="sm">
            <a href={"/api/v1/events" + suffix}>
              <Braces aria-hidden="true" />
              JSON
            </a>
          </Button>
        </nav>
      </section>
      <FeedFilters
        initialFilters={{ ...query, q: params.get("q") ?? "" }}
        technologies={technologies}
      />
      <section className="mb-8 min-w-0" aria-label="Security announcements">
        {query.before !== undefined && rows.length > 0 ? (
          <Button asChild variant="ghost" size="sm" className="mb-4">
            <Link href={latest}>
              <ArrowLeft aria-hidden="true" />
              Back to latest events
            </Link>
          </Button>
        ) : null}
        {error ? (
          <Card role="alert" className="shadow-none">
            <CardContent className="text-sm text-muted-foreground">
              {error}.{" "}
              <Link
                href="/"
                className="text-primary underline underline-offset-4"
              >
                Reset filters
              </Link>
            </CardContent>
          </Card>
        ) : unavailable ? (
          <Card role="status" className="shadow-none">
            <CardContent className="text-sm text-muted-foreground">
              Feed temporarily unavailable.{" "}
              <Link
                href={latest}
                className="text-primary underline underline-offset-4"
              >
                Try again
              </Link>
            </CardContent>
          </Card>
        ) : !rows.length ? (
          <Card role="status" className="shadow-none">
            <CardContent className="text-sm text-muted-foreground">
              {query.before !== undefined ? (
                <>
                  No earlier events.{" "}
                  <Link
                    href={latest}
                    className="text-primary underline underline-offset-4"
                  >
                    Back to latest events
                  </Link>
                </>
              ) : hasFilters ? (
                "No events match your filters."
              ) : (
                "No events yet."
              )}
            </CardContent>
          </Card>
        ) : (
          <ScoreProvider cves={[...new Set(rows.flatMap(scoreCves))].sort()}>
            <div className="space-y-6">
              {groups.map((group, index) => (
                <section
                  className="event-day space-y-3"
                  key={group.day + "-" + index}
                  aria-labelledby={"day-" + index}
                >
                  <h2
                    id={"day-" + index}
                    className="day-heading border-b pb-3 font-mono text-xs font-normal text-muted-foreground"
                  >
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
                      returnTo={returnTo}
                    />
                  ))}
                </section>
              ))}
            </div>
          </ScoreProvider>
        )}
        {hasMore && rows.length ? (
          <div className="pt-6">
            <Button asChild variant="outline">
              <Link
                href={feedLink(query, {
                  before: String(rows.at(-1)!.id),
                  limit: String(query.limit),
                })}
              >
                Older events
                <ArrowDown aria-hidden="true" />
              </Link>
            </Button>
          </div>
        ) : null}
      </section>
    </main>
  );
}
