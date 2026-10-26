import Link from "next/link";
import type { ReactNode } from "react";
import type { FeedEvent } from "@/lib/events";
import type { Filters } from "@/lib/filters";
import { feedLink } from "@/lib/feed-view";
import { registry, vendorRegistry } from "@/lib/registry";
import { severityLabel, type Severity } from "@/lib/priority";
import { Badge } from "./ui/badge";

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

export function EventBadges({
  event,
  children,
}: {
  event: FeedEvent;
  children?: ReactNode;
}) {
  const severity =
    event.payload.kind === "withdrawal"
      ? "unknown"
      : (event.priority?.severity ?? event.payload.severity);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={severityStyles[severity]}>
        {severityLabel(severity)}
      </Badge>
      {children}
      {event.payload.kind !== "withdrawal" && event.priority?.fix_available ? (
        <Badge variant="secondary">Fix available</Badge>
      ) : null}
    </div>
  );
}

export function EventMetadata({
  event,
  filters = {},
  children,
}: {
  event: FeedEvent;
  filters?: Filters;
  children?: ReactNode;
}) {
  return (
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
      {children}
    </div>
  );
}
