import Link from "next/link";
import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink, feedTimestamp } from "@/lib/feed-view";
import { itemLink, summaryPreview } from "@/lib/item-links";
import { registry, vendorRegistry } from "@/lib/registry";
import { priorityLabels } from "@/lib/priority";
import { Badge } from "./ui/badge";
import { Card, CardDescription, CardFooter, CardHeader } from "./ui/card";
import { EventKindBadge } from "./event-kind-badge";
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
    <article
      className="event-card scroll-mt-4 [overflow-wrap:anywhere]"
      id={"event-" + event.id}
    >
      <Card className="gap-3 rounded-lg py-5 shadow-none">
        <CardHeader className="gap-2 px-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <EventKindBadge kind={event.payload.kind} />
            {event.payload.kind !== "withdrawal"
              ? priorityLabels(event.priority).map((label) => (
                  <Badge variant="secondary" key={label}>
                    {label}
                  </Badge>
                ))
              : null}
            <Link
              className="event-source hover:text-primary hover:underline"
              href={feedLink({ ...filters, source: event.source_id })}
            >
              {sourceNames.get(event.source_id) ?? event.source_id}
            </Link>
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
            <time
              dateTime={event.published_at}
              title="Date added to the feed (UTC)"
              className="w-full text-xs tabular-nums text-muted-foreground sm:ml-auto sm:w-auto"
            >
              {feedTimestamp(event.published_at)}
            </time>
          </div>
          <h3 className="text-lg leading-snug font-medium tracking-tight">
            <Link href={href} className="hover:text-primary">
              {event.payload.title}
            </Link>
          </h3>
          <CardDescription className="text-sm leading-relaxed">
            <p className="event-summary line-clamp-2">
              {summaryPreview(event.payload.summary)}
            </p>
          </CardDescription>
        </CardHeader>
        {products.length || cves.length || remaining > 0 ? (
          <CardFooter className="flex-wrap gap-1.5 px-5">
            {products.map((product, i) => (
              <Badge
                asChild
                variant="outline"
                key={i}
                className="max-w-full min-w-0 rounded-md font-mono text-[11px] whitespace-normal"
              >
                <Link
                  href={feedLink({
                    ...filters,
                    technology: technologyKey(product.name.value),
                  })}
                >
                  {product.name.value}
                </Link>
              </Badge>
            ))}
            {cves.map((cve) => (
              <Badge
                asChild
                variant="outline"
                key={cve.value}
                className="rounded-md font-mono text-[11px]"
              >
                <Link href={feedLink({ ...filters, cve: cve.value })}>
                  {cve.value}
                </Link>
              </Badge>
            ))}
            {remaining > 0 ? (
              <Badge asChild variant="secondary">
                <Link href={href}>+{remaining} more</Link>
              </Badge>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </article>
  );
}
