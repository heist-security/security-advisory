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
    <main id="main" className="site-container advisory-detail">
      <a className="detail-back" href={returnTo}>
        Back to feed
      </a>
      <h1>Advisory temporarily unavailable</h1>
      <p role="alert">
        We couldn’t load this advisory.{" "}
        <a
          href={
            href +
            (returnTo === "/"
              ? ""
              : "?" + new URLSearchParams({ from: returnTo }))
          }
        >
          Try again
        </a>
        .
      </p>
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
    <main id="main" className="site-container advisory-detail">
      <nav className="detail-navigation" aria-label="Advisory navigation">
        <a className="detail-back" href={returnTo}>
          ← Back to feed
        </a>
        {!event.group && event.group_id ? (
          <a
            href={
              advisoryPath(event.group_id) +
              (returnTo === "/"
                ? ""
                : "?" + new URLSearchParams({ from: returnTo }))
            }
          >
            View current advisory
          </a>
        ) : null}
      </nav>
      <article>
        <header className="advisory-heading">
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
            <span>
              {members.length} source{" "}
              {members.length === 1 ? "record" : "records"}
            </span>
          </div>
          <h1>{event.payload.title}</h1>
          <p className="advisory-summary">{event.payload.summary}</p>
          <div className="advisory-dates">
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
          <a className="original-link" href={event.source_url}>
            Original source ↗
          </a>
        </header>
        {event.context_update ? (
          <p className="detail-update">
            CVE context updated. The publisher announcement is unchanged.
          </p>
        ) : null}
        {event.group &&
        event.group.change !== "published" &&
        event.group.changed.id !== primaryId ? (
          <p className="detail-update">
            Updated source:{" "}
            <a href={"#source-" + event.group.changed.advisory_id}>
              {event.group.changed.payload.structured?.id ??
                event.group.changed.source_id}
            </a>
            {event.group.changed.payload.kind === "withdrawal"
              ? ". This source record was withdrawn."
              : ". See its source record below."}
          </p>
        ) : null}
        {event.group?.superseded_by.length ? (
          <section className="detail-update">
            <h2>Group membership updated</h2>
            <p>This advisory is now represented by:</p>
            <ul>
              {event.group.superseded_by.map((id) => (
                <li key={id}>
                  <a href={advisoryPath(id)}>{id}</a>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <nav className="detail-sections" aria-label="Advisory sections">
          {members.map((member) => (
            <a key={member.advisory_id} href={"#source-" + member.advisory_id}>
              {member.payload.structured?.id ?? member.source_id}
              {member.id === primaryId ? " · Primary source" : ""}
            </a>
          ))}
          {event.group ? <a href="#history">Revision history</a> : null}
        </nav>
        <div className="source-records">
          {members.map((member) => (
            <SourceDetails
              key={member.advisory_id}
              event={member}
              primary={member.id === primaryId}
            />
          ))}
        </div>
        {event.group ? (
          <section id="history" className="revision-history">
            <h2>Revision history</h2>
            {!historyAvailable ? (
              <p role="status">
                Revision history is temporarily unavailable.{" "}
                <a href={historyHref(historyBefore)}>Try again</a>.
              </p>
            ) : !history?.length ? (
              <p>
                No {historyBefore === undefined ? "source" : "earlier"}{" "}
                revisions available.
              </p>
            ) : (
              <ol>
                {history.slice(0, 10).map((row) => (
                  <li key={row.id}>
                    <a href={itemLink(row, returnTo)}>
                      <time dateTime={row.published_at}>
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
                        {row.payload.structured?.id ?? row.source_id} · Revision{" "}
                        {row.revision}
                      </span>
                      <span>
                        {row.payload.kind === "withdrawal"
                          ? "Withdrawn"
                          : row.context_update
                            ? "Risk context updated"
                            : "Source updated"}
                      </span>
                    </a>
                  </li>
                ))}
              </ol>
            )}
            <div className="history-pagination">
              {historyBefore !== undefined ? (
                <a href={historyHref()}>Latest revisions</a>
              ) : null}
              {history && history.length > 10 ? (
                <a href={historyHref(history[9].id)}>Older revisions</a>
              ) : null}
            </div>
          </section>
        ) : null}
      </article>
    </main>
  );
}
