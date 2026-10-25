import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink } from "@/lib/feed-view";
import { itemLink, summaryPreview } from "@/lib/item-links";
import { registry, vendorRegistry } from "@/lib/registry";
import { priorityLabels } from "@/lib/priority";
const sourceNames = new Map(
  [...vendorRegistry, ...registry].map((source) => [source.id, source.name]),
);
export function EventCard({
  event,
  filters = {},
  returnTo = "/",
}: {
  event: FeedEvent;
  filters?: Filters;
  returnTo?: string;
}) {
  const href = itemLink(event, returnTo);
  const products = event.payload.products.slice(0, 3);
  const cves = event.payload.related_cves.slice(0, 2);
  const remaining =
    event.payload.products.length +
    event.payload.related_cves.length -
    products.length -
    cves.length;
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
        {event.group && event.group.members.length > 1 ? (
          <span className="group-sources">
            {event.group.members.length} source records
          </span>
        ) : null}
        {event.context_update ? <span>Risk context updated</span> : null}
        {event.group?.changed.payload.kind === "withdrawal" &&
        event.payload.kind !== "withdrawal" ? (
          <span>Source withdrawal</span>
        ) : null}
      </div>
      <h3>
        <a href={href}>{event.payload.title}</a>
      </h3>
      <p className="event-summary">{summaryPreview(event.payload.summary)}</p>
      <div className="tags">
        {products.map((product, i) => (
          <a
            key={i}
            href={feedLink({
              ...filters,
              technology: technologyKey(product.name.value),
            })}
          >
            {product.name.value}
          </a>
        ))}
        {cves.map((cve) => (
          <a key={cve.value} href={feedLink({ ...filters, cve: cve.value })}>
            {cve.value}
          </a>
        ))}
        {remaining > 0 ? <a href={href}>+{remaining} more</a> : null}
      </div>
    </article>
  );
}
