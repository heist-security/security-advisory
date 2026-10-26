import type { FeedEvent } from "@/lib/events";
import { Badge } from "./ui/badge";
import { cn } from "@/lib/utils";
const kindStyles = {
  patch: "border-blue-200 bg-blue-50 text-blue-800",
  advisory: "border-violet-200 bg-violet-50 text-violet-800",
  mitigation: "border-amber-200 bg-amber-50 text-amber-800",
  withdrawal: "border-red-200 bg-red-50 text-red-800",
  other: "border-border bg-muted text-muted-foreground",
};

export function EventKindBadge({
  kind,
}: {
  kind: FeedEvent["payload"]["kind"];
}) {
  return (
    <Badge variant="outline" className={cn("capitalize", kindStyles[kind])}>
      {kind}
    </Badge>
  );
}
