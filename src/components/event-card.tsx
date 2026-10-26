import Link from "next/link";
import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink, feedTimestamp } from "@/lib/feed-view";
import { itemLink, summaryPreview } from "@/lib/item-links";
import { EventBadges, EventMetadata } from "./event-metadata";
import { Card, CardDescription, CardFooter, CardHeader } from "./ui/card";
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
          <EventBadges event={event} />
          <h3 className="text-lg leading-snug font-medium tracking-tight">
            <Link href={href} className="hover:text-primary">
              {event.payload.title}
            </Link>
          </h3>
          <EventMetadata event={event} filters={filters}>
            <time
              dateTime={event.published_at}
              title="Date added to the feed (UTC)"
              className="w-full text-xs tabular-nums text-muted-foreground sm:ml-auto sm:w-auto"
            >
              {feedTimestamp(event.published_at)}
            </time>
          </EventMetadata>
          <CardDescription className="text-sm leading-relaxed">
            <p className="event-summary line-clamp-2">
              {summaryPreview(event.payload.summary)}
            </p>
          </CardDescription>
        </CardHeader>
        {products.length || cves.length || remaining > 0 ? (
          <CardFooter className="flex-wrap gap-x-4 gap-y-1 px-5 text-xs text-muted-foreground">
            {products.length ? (
              <span>
                Products:{" "}
                {products.map((product, i) => (
                  <span key={i}>
                    {i > 0 ? ", " : null}
                    <Link
                      className="hover:text-primary hover:underline"
                      href={feedLink({
                        ...filters,
                        technology: technologyKey(product.name.value),
                      })}
                    >
                      {product.name.value}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}
            {cves.length ? (
              <span>
                CVEs:{" "}
                {cves.map((cve, i) => (
                  <span key={cve.value}>
                    {i > 0 ? ", " : null}
                    <Link
                      className="hover:text-primary hover:underline"
                      href={feedLink({ ...filters, cve: cve.value })}
                    >
                      {cve.value}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}
            {remaining > 0 ? (
              <Link href={href} className="hover:text-primary hover:underline">
                +{remaining} more
              </Link>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </article>
  );
}
