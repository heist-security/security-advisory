import type { FeedEvent } from "@/lib/events";
import { technologyKey } from "@/lib/filters";
export function EventCard({ event }: { event: FeedEvent }) {
  return (
    <article className="event-card">
      <div className="event-meta">
        <span className={"badge " + event.payload.kind}>
          {event.payload.kind}
        </span>
        <span>{event.source_id}</span>
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
        <a href={event.source_url}>
          {event.payload.title} <span aria-hidden="true">↗</span>
        </a>
      </h3>
      <p>{event.payload.summary}</p>
      <div className="tags">
        {event.payload.products.map((p, i) => (
          <a
            key={i}
            href={
              "/?technology=" + encodeURIComponent(technologyKey(p.name.value))
            }
          >
            {p.name.value}
            {p.fixed_versions.length
              ? " → " + p.fixed_versions.map((v) => v.value).join(", ")
              : ""}
          </a>
        ))}
        {event.payload.related_cves.map((c) => (
          <a key={c.value} href={"/?cve=" + encodeURIComponent(c.value)}>
            {c.value}
          </a>
        ))}
      </div>
      <div className="event-foot">
        <span>
          {event.extraction_method === "system"
            ? "Automated correction"
            : "Machine-extracted"}{" "}
          · Revision {event.revision}
        </span>
        <a href={event.source_url}>Verify original source ↗</a>
      </div>
    </article>
  );
}
