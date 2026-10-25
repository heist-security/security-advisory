import type { FeedEvent } from "@/lib/events";
import { technologyKey, type Filters } from "@/lib/filters";
import { feedLink } from "@/lib/feed-view";
import { itemLink, summaryPreview } from "@/lib/item-links";
import { registry, vendorRegistry } from "@/lib/registry";
import { priorityLabels } from "@/lib/priority";
import { Badge } from "./ui/badge";
import { Card, CardDescription, CardFooter, CardHeader } from "./ui/card";
import { cn } from "@/lib/utils";
const kindStyles = {
  patch: "border-blue-200 bg-blue-50 text-blue-800",
  advisory: "border-violet-200 bg-violet-50 text-violet-800",
  mitigation: "border-amber-200 bg-amber-50 text-amber-800",
  withdrawal: "border-red-200 bg-red-50 text-red-800",
  other: "border-border bg-muted text-muted-foreground",
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
            <Badge
              variant="outline"
              className={cn("capitalize", kindStyles[event.payload.kind])}
            >
              {event.payload.kind}
            </Badge>
            {event.payload.kind !== "withdrawal"
              ? priorityLabels(event.priority).map((label) => (
                  <Badge variant="secondary" key={label}>
                    {label}
                  </Badge>
                ))
              : null}
            <a
              className="event-source hover:text-primary hover:underline"
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
          <h3 className="text-lg leading-snug font-medium tracking-tight">
            <a href={href} className="hover:text-primary">
              {event.payload.title}
            </a>
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
                <a
                  href={feedLink({
                    ...filters,
                    technology: technologyKey(product.name.value),
                  })}
                >
                  {product.name.value}
                </a>
              </Badge>
            ))}
            {cves.map((cve) => (
              <Badge
                asChild
                variant="outline"
                key={cve.value}
                className="rounded-md font-mono text-[11px]"
              >
                <a href={feedLink({ ...filters, cve: cve.value })}>
                  {cve.value}
                </a>
              </Badge>
            ))}
            {remaining > 0 ? (
              <Badge asChild variant="secondary">
                <a href={href}>+{remaining} more</a>
              </Badge>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </article>
  );
}
