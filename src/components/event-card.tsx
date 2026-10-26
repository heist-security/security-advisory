import Link from "next/link";
import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink, feedTimestamp } from "@/lib/feed-view";
import { itemLink, summaryPreview } from "@/lib/item-links";
import { registry, vendorRegistry } from "@/lib/registry";
import { severityLabel, type Severity } from "@/lib/priority";
import { Badge } from "./ui/badge";
import { Card, CardDescription, CardFooter, CardHeader } from "./ui/card";
const severityStyles: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-blue-200 bg-blue-50 text-blue-800",
  unknown: "border-border bg-muted text-muted-foreground",
};
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
  const severity =
    event.payload.kind === "withdrawal"
      ? "unknown"
      : (event.priority?.severity ?? event.payload.severity);
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
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={severityStyles[severity]}>
              {severityLabel(severity)}
            </Badge>
            {event.payload.kind !== "withdrawal" &&
            event.priority?.fix_available ? (
              <Badge variant="secondary">Fix available</Badge>
            ) : null}
          </div>
          <h3 className="text-lg leading-snug font-medium tracking-tight">
            <Link href={href} className="hover:text-primary">
              {event.payload.title}
            </Link>
          </h3>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span>
              Type: <span className="capitalize">{event.payload.kind}</span>
            </span>
            <span>
              Source:{" "}
              <Link
                className="event-source hover:text-primary hover:underline"
                href={feedLink({ ...filters, source: event.source_id })}
              >
                {sourceNames.get(event.source_id) ?? event.source_id}
              </Link>
            </span>
            {event.group && event.group.members.length > 1 ? (
              <span className="group-sources">
                {event.group.members.length} source records
              </span>
            ) : null}
            {event.context_update ? <span>Risk context updated</span> : null}
            {event.payload.kind !== "withdrawal" &&
            event.priority?.known_exploited ? (
              <span>Known exploited</span>
            ) : null}
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
