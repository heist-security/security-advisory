import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink } from "@/lib/feed-view";
import { registry, vendorRegistry } from "@/lib/registry";
import { EventDetails } from "./event-details";
import { priorityLabels } from "@/lib/priority";
const sourceNames = new Map(
  [...vendorRegistry, ...registry].map((source) => [source.id, source.name]),
);
export function EventCard({
  event,
  filters = {},
  expanded = false,
}: {
  event: FeedEvent;
  filters?: Filters;
  expanded?: boolean;
}) {
  return (
    <article className="event-card" id={"event-" + event.id}>
      <div className="event-meta">
        <span className={"badge " + event.payload.kind}>
          {event.payload.kind}
        </span>
        {event.payload.kind !== "withdrawal"
          ? priorityLabels(event.priority).map((label) => (
              <span className="priority-label" key={label}>
                {label}
              </span>
            ))
          : null}
        <a
          className="event-source"
          href={feedLink({ ...filters, source: event.source_id })}
        >
          {sourceNames.get(event.source_id) ?? event.source_id}
        </a>
        <time dateTime={event.published_at}>
          {new Date(event.published_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            timeZone: "UTC",
          })}
        </time>
      </div>
      <h3>
        <a href={event.source_url}>{event.payload.title}</a>
      </h3>
      <p>{event.payload.summary}</p>
      {event.context_update ? (
        <p className="context-update">
          CVE context updated · The publisher announcement is unchanged.
        </p>
      ) : null}
      {event.source_published_at ? (
        <p className="publisher-date">
          Announced{" "}
          <time dateTime={event.source_published_at}>
            {new Date(event.source_published_at).toLocaleDateString("en-GB", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "UTC",
            })}
          </time>
        </p>
      ) : null}
      <div className="tags">
        {event.payload.products.map((p, i) => (
          <a
            key={i}
            href={feedLink({
              ...filters,
              technology: technologyKey(p.name.value),
            })}
          >
            {p.name.value}
            {p.fixed_versions.length
              ? " · Fixed in " + p.fixed_versions.map((v) => v.value).join(", ")
              : ""}
          </a>
        ))}
        {event.payload.related_cves.map((c) => (
          <a key={c.value} href={feedLink({ ...filters, cve: c.value })}>
            {c.value}
          </a>
        ))}
      </div>
      <div className="event-foot">
        <span>
          {event.extraction_method === "system"
            ? "Automated correction"
            : event.extraction_method === "structured"
              ? "Structured advisory"
              : "Machine-extracted"}{" "}
          · Revision {event.revision}
        </span>
        <a href={event.source_url}>Original source</a>
      </div>
      {expanded ? <EventDetails event={event} /> : null}
    </article>
  );
}
