import { cachedEvents } from "@/lib/cached-events";
import { configured } from "@/lib/db";
import type { FeedEvent } from "@/lib/events";
import {
  filterQuery,
  pageParams,
  parseEventQuery,
  type EventQuery,
  type SearchParams,
} from "@/lib/filters";
import { registry, categoryCount, channelCounts } from "@/lib/registry";
import { FeedFilters } from "@/components/feed-filters";
import { EventCard } from "@/components/event-card";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  let query: EventQuery = { limit: 20 },
    error = "",
    unavailable = false;
  try {
    query = parseEventQuery(pageParams(await searchParams), 20);
  } catch (cause) {
    error = (cause as Error).message;
  }
  let rows: FeedEvent[] = [];
  if (configured() && !error) {
    try {
      rows = await cachedEvents(query);
    } catch {
      unavailable = true;
    }
  }
  const filters = filterQuery(query),
    suffix = filters.size ? "?" + filters : "";
  const older = new URLSearchParams(filters);
  if (rows.length)
    older.set("before", String(Math.min(...rows.map((r) => r.id))));
  const filtered = filters.size > 0;
  return (
    <main id="main" className="container">
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span className="signal" /> OPEN SECURITY FEED{" "}
            <span className="alpha">ALPHA</span>
          </div>
          <h1>
            Security changes.
            <br />
            <span>One place to listen.</span>
          </h1>
          <p>
            Advisories, patches, and mitigations from across the software
            ecosystem. One open feed, with the source behind every event.
          </p>
          <div className="actions">
            <a className="button primary" href={"/feed" + suffix}>
              Browse the feed →
            </a>
            <a className="button" href={"/feed.xml" + suffix}>
              Subscribe via RSS ↗
            </a>
          </div>
        </div>
        <aside className="subscription-panel">
          <div className="panel-label">ONE STREAM · YOUR STACK</div>
          <div className="stream-tags">
            <span>Runtimes</span>
            <span>Cloud</span>
            <span>Libraries</span>
            <span>Infrastructure</span>
          </div>
          <div className="stream-line" aria-hidden="true" />
          <div className="stream-target">
            <span className="signal" />
            <strong>Heist Feed</strong>
            <span>WEB + RSS + JSON</span>
          </div>
          <p>
            Listen to everything, or subscribe to the technologies and CVEs that
            matter to you.
          </p>
          <a className="endpoint" href={"/feed.xml" + suffix}>
            <code>/feed.xml{suffix}</code>
            <span>↗</span>
          </a>
          <small>
            {filtered
              ? "Your filters also apply to this RSS subscription."
              : "No account or API key required."}
          </small>
        </aside>
      </section>
      <section className="coverage" aria-label="Source coverage">
        <div>
          <strong>{registry.length}</strong>
          <span>source streams</span>
        </div>
        <div>
          <strong>{categoryCount}</strong>
          <span>categories</span>
        </div>
        <p>
          {channelCounts["security-advisories"]} advisory ·{" "}
          {channelCounts["mixed-announcements"]} mixed ·{" "}
          {channelCounts["release-notes"]} release-note streams
        </p>
        <a href="/sources">Inspect coverage ↗</a>
      </section>
      <section className="feed-section">
        <div className="section-heading">
          <div>
            <div className="eyebrow">THE UNIFIED STREAM</div>
            <h2>
              {filtered ? "Your security feed" : "Latest security events"}
            </h2>
          </div>
          <a href={"/feed" + suffix}>Open the full feed →</a>
        </div>
        <FeedFilters filters={query} />
        {error ? (
          <p className="notice" role="alert">
            {error}. <a href="/">Reset filters</a>.
          </p>
        ) : null}
        <div className="feed-links">
          <a href={"/feed.xml" + suffix}>
            RSS{filtered ? " with these filters" : ""} ↗
          </a>
          <a href={"/api/v1/events" + suffix}>
            JSON{filtered ? " with these filters" : ""} ↗
          </a>
          <span>Corrections stay in your subscription.</span>
        </div>
        {rows.length ? (
          <div className="events">
            {rows.map((event) => (
              <EventCard key={event.id} event={event} />
            ))}
          </div>
        ) : (
          <div className="empty">
            <span className="empty-mark" aria-hidden="true">
              ↳
            </span>
            <div>
              <h3>
                {unavailable
                  ? "The feed is temporarily unavailable."
                  : filtered
                    ? "No matching events yet."
                    : "Waiting for the first announcements."}
              </h3>
              <p>
                {unavailable
                  ? "Please try again shortly."
                  : filtered
                    ? "Try another technology or clear your filters."
                    : "Browse the source catalog while the first source-backed events are collected."}
              </p>
            </div>
          </div>
        )}
        {rows.length === query.limit && query.after === undefined ? (
          <a className="button pagination-next" href={"/?" + older}>
            Older events →
          </a>
        ) : null}
      </section>
      <section className="principles">
        <div>
          <span>01 / COVERAGE</span>
          <h3>More than CVEs</h3>
          <p>
            Security fixes can matter even when no new vulnerability ID is
            assigned.
          </p>
        </div>
        <div>
          <span>02 / EVIDENCE</span>
          <h3>Always source-backed</h3>
          <p>
            Product and version fields carry quotations. Original publishers
            remain authoritative.
          </p>
        </div>
        <div>
          <span>03 / CONTINUITY</span>
          <h3>Updates stay visible</h3>
          <p>
            Stable advisory IDs and revision events let you follow changes and
            corrections.
          </p>
        </div>
      </section>
    </main>
  );
}
