import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
import { EventKindBadge } from "./event-kind-badge";
import type { FeedEvent } from "@/lib/events";
import { priorityLabels } from "@/lib/priority";
import { advisoryPath, itemLink, itemPath } from "@/lib/item-links";
import { SourceDetails } from "./event-details";

export function DetailUnavailable({
  href,
  returnTo,
}: {
  href: string;
  returnTo: string;
}) {
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 [overflow-wrap:anywhere] sm:px-8 sm:py-8"
    >
      <Button asChild variant="ghost" size="sm">
        <Link href={returnTo}>Back to feed</Link>
      </Button>
      <h1 className="text-2xl font-semibold tracking-tight">
        Advisory temporarily unavailable
      </h1>
      <Alert variant="destructive">
        <AlertDescription>
          We couldn’t load this advisory.{" "}
          <Link
            href={
              href +
              (returnTo === "/"
                ? ""
                : "?" + new URLSearchParams({ from: returnTo }))
            }
          >
            Try again
          </Link>
          .
        </AlertDescription>
      </Alert>
    </main>
  );
}

export function AdvisoryDetail({
  event,
  returnTo,
  history,
  historyAvailable = true,
  historyBefore,
}: {
  event: FeedEvent;
  returnTo: string;
  history?: FeedEvent[];
  historyAvailable?: boolean;
  historyBefore?: number;
}) {
  const members = event.group?.members ?? [event];
  const primaryId = event.group?.primary_event_id ?? event.id;
  const historyHref = (before?: number) => {
    const params = new URLSearchParams();
    if (returnTo !== "/") params.set("from", returnTo);
    if (before !== undefined) params.set("before", String(before));
    return itemPath(event) + (params.size ? "?" + params : "") + "#history";
  };
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 [overflow-wrap:anywhere] sm:px-8 sm:py-8"
    >
      <nav
        className="flex flex-wrap items-center justify-between gap-3 text-sm"
        aria-label="Advisory navigation"
      >
        <Button asChild variant="ghost" size="sm">
          <Link href={returnTo}>← Back to feed</Link>
        </Button>
        {!event.group && event.group_id ? (
          <Link
            href={
              advisoryPath(event.group_id) +
              (returnTo === "/"
                ? ""
                : "?" + new URLSearchParams({ from: returnTo }))
            }
          >
            View current advisory
          </Link>
        ) : null}
      </nav>
      <article className="space-y-6">
        <Card className="shadow-none">
          <CardHeader className="gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <EventKindBadge kind={event.payload.kind} />
              {event.payload.kind !== "withdrawal"
                ? priorityLabels(event.priority).map((label) => (
                    <Badge variant="secondary" key={label}>
                      {label}
                    </Badge>
                  ))
                : null}
              <span>
                {members.length} source{" "}
                {members.length === 1 ? "record" : "records"}
              </span>
            </div>
            <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
              {event.payload.title}
            </h1>
            <p className="text-base leading-relaxed whitespace-pre-line text-muted-foreground">
              {event.payload.summary}
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              {event.source_published_at ? (
                <span>
                  Announced{" "}
                  <time dateTime={event.source_published_at}>
                    {new Date(event.source_published_at).toLocaleDateString(
                      "en-GB",
                      {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        timeZone: "UTC",
                      },
                    )}
                  </time>
                </span>
              ) : null}
              <span>
                {event.group
                  ? "Group revision " + event.group.revision
                  : "Source revision " + event.revision}
              </span>
            </div>
            <Button asChild variant="outline" size="sm" className="w-fit">
              <a href={event.source_url}>Original source ↗</a>
            </Button>
          </CardHeader>
        </Card>
        {event.context_update ? (
          <Alert role="status">
            <AlertDescription>
              CVE context updated. The publisher announcement is unchanged.
            </AlertDescription>
          </Alert>
        ) : null}
        {event.group &&
        event.group.change !== "published" &&
        event.group.changed.id !== primaryId ? (
          <Alert role="status">
            <AlertDescription>
              Updated source:{" "}
              <a href={"#source-" + event.group.changed.advisory_id}>
                {event.group.changed.payload.structured?.id ??
                  event.group.changed.source_id}
              </a>
              {event.group.changed.payload.kind === "withdrawal"
                ? ". This source record was withdrawn."
                : ". See its source record below."}
            </AlertDescription>
          </Alert>
        ) : null}
        {event.group?.superseded_by.length ? (
          <Alert role="status">
            <AlertTitle>Group membership updated</AlertTitle>
            <AlertDescription>
              <p>This advisory is now represented by:</p>
              <ul>
                {event.group.superseded_by.map((id) => (
                  <li key={id}>
                    <Link href={advisoryPath(id)}>{id}</Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}
        <nav
          className="flex flex-wrap gap-2 border-y py-3 text-sm [&_a]:rounded-md [&_a]:px-3 [&_a]:py-2 [&_a:hover]:bg-accent"
          aria-label="Advisory sections"
        >
          {members.map((member) => (
            <a key={member.advisory_id} href={"#source-" + member.advisory_id}>
              {member.payload.structured?.id ?? member.source_id}
              {member.id === primaryId ? " · Primary source" : ""}
            </a>
          ))}
          {event.group ? <a href="#history">Revision history</a> : null}
        </nav>
        <div className="space-y-6">
          {members.map((member) => (
            <SourceDetails
              key={member.advisory_id}
              event={member}
              primary={member.id === primaryId}
            />
          ))}
        </div>
        {event.group ? (
          <Card id="history" className="scroll-mt-6 shadow-none">
            <CardHeader>
              <h2 className="text-xl font-semibold tracking-tight">
                Revision history
              </h2>
            </CardHeader>
            <CardContent>
              {!historyAvailable ? (
                <p role="status">
                  Revision history is temporarily unavailable.{" "}
                  <Link href={historyHref(historyBefore)}>Try again</Link>.
                </p>
              ) : !history?.length ? (
                <p>
                  No {historyBefore === undefined ? "source" : "earlier"}{" "}
                  revisions available.
                </p>
              ) : (
                <ol className="divide-y">
                  {history.slice(0, 10).map((row) => (
                    <li key={row.id}>
                      <Link
                        className="grid gap-2 rounded-md py-4 text-sm hover:bg-muted sm:grid-cols-[110px_1fr_auto] sm:gap-3"
                        href={itemLink(row, returnTo)}
                      >
                        <time
                          className="text-muted-foreground"
                          dateTime={row.published_at}
                        >
                          {new Date(row.published_at).toLocaleDateString(
                            "en-GB",
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                              timeZone: "UTC",
                            },
                          )}
                        </time>
                        <span>
                          {row.payload.structured?.id ?? row.source_id} ·
                          Revision {row.revision}
                        </span>
                        <span>
                          {row.payload.kind === "withdrawal"
                            ? "Withdrawn"
                            : row.context_update
                              ? "Risk context updated"
                              : "Source updated"}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
              <div className="mt-4 flex flex-wrap gap-4 text-sm text-primary">
                {historyBefore !== undefined ? (
                  <Link href={historyHref()}>Latest revisions</Link>
                ) : null}
                {history && history.length > 10 ? (
                  <Link href={historyHref(history[9].id)}>Older revisions</Link>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </article>
    </main>
  );
}
