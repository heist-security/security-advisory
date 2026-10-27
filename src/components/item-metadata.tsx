import Link from "next/link";
import { sourceName } from "@/server/services";
import type { ReactNode } from "react";
import type { FeedItem, Severity } from "@/domain/feed-item";
import { severityLabel } from "@/domain/feed-item";
import type { Filters } from "@/presentation/filters";
import { feedLink } from "@/presentation/feed-view";
import { itemDescription } from "@/presentation/item-description";
import { Badge } from "./ui/badge";
const styles: Record<Severity, string> = {
  critical: "border-red-200 bg-red-50 text-red-800",
  high: "border-orange-200 bg-orange-50 text-orange-800",
  medium: "border-amber-200 bg-amber-50 text-amber-800",
  low: "border-blue-200 bg-blue-50 text-blue-800",
  unknown: "border-border bg-muted text-muted-foreground",
};
export function ItemBadges({
  item,
  children,
}: {
  item: FeedItem;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge variant="outline" className={styles[item.severity]}>
        {severityLabel(item.severity)}
      </Badge>
      {children}
      {item.fix_available ? (
        <Badge variant="secondary">Fix available</Badge>
      ) : null}
      {item.known_exploited ? (
        <Badge variant="secondary">Known exploited</Badge>
      ) : null}
    </div>
  );
}
export function ItemMetadata({
  item,
  filters = {},
  children,
}: {
  item: FeedItem;
  filters?: Filters;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      <span>
        Type: <span className="capitalize">{item.kind}</span>
      </span>
      <span>
        Sources:{" "}
        {item.source_ids.map((source, i) => (
          <span key={source}>
            {i ? ", " : null}
            <Link
              className="item-source hover:text-primary hover:underline"
              href={feedLink({ ...filters, source })}
            >
              {sourceName(source)}
            </Link>
          </span>
        ))}
      </span>
      {item.records.length > 1 ? (
        <span>{item.records.length} source records</span>
      ) : null}
      {itemDescription(item).identifiers.map(({ id, label }) => (
        <span key={id}>
          {label}: <span className="font-mono">{id}</span>
        </span>
      ))}
      {children}
    </div>
  );
}
