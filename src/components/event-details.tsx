import type { FeedEvent } from "@/lib/events";
type Fact = { value: string; evidence: string };
function Facts({ label, facts }: { label: string; facts: Fact[] }) {
  return (
    <div className="fact-group">
      <dt>{label}</dt>
      <dd>
        {facts.length ? (
          facts.map((fact, i) => (
            <div className="fact" key={i}>
              <strong>{fact.value}</strong>
              <blockquote>{fact.evidence}</blockquote>
            </div>
          ))
        ) : (
          <span className="unspecified">Not stated in this extraction</span>
        )}
      </dd>
    </div>
  );
}
export function EventDetails({ event }: { event: FeedEvent }) {
  const p = event.payload;
  return (
    <details className="event-details">
      <summary>
        Evidence and details <span aria-hidden="true">+</span>
      </summary>
      <div className="event-details-body">
        <p className="detail-disclaimer">
          These are machine-extracted claims. Quotations show the recorded
          source text; verify the original announcement before acting.
        </p>
        {event.extraction_method === "system" ? (
          <div className="correction-note">
            <strong>Correction to Heist’s extraction</strong>
            <p>
              This replaces the earlier extraction. It does not mean that the
              publisher withdrew its announcement.
            </p>
            {p.supersedes_event_id ? (
              <a
                href={
                  "/feed?before=" +
                  (p.supersedes_event_id + 1) +
                  "#event-" +
                  p.supersedes_event_id
                }
              >
                View the preceding event →
              </a>
            ) : null}
          </div>
        ) : null}
        {p.evidence ? (
          <div className="supporting-quote">
            <h4>Security context</h4>
            <blockquote>{p.evidence}</blockquote>
          </div>
        ) : null}
        {p.products.map((product, i) => (
          <section className="product-evidence" key={i}>
            <h4>{product.name.value}</h4>
            <blockquote>{product.name.evidence}</blockquote>
            <dl>
              <Facts
                label="Affected versions"
                facts={product.affected_versions}
              />
              <Facts label="Fixed versions" facts={product.fixed_versions} />
              <Facts label="Prerequisites" facts={product.prerequisites} />
            </dl>
          </section>
        ))}
        {p.related_cves.length ? (
          <dl>
            <Facts label="Related CVEs" facts={p.related_cves} />
          </dl>
        ) : null}
        {event.extraction_method !== "system" ? (
          <div className="severity-evidence">
            <h4>Publisher severity</h4>
            <p>
              {p.severity === "unknown"
                ? "No explicit severity was extracted."
                : p.severity}
            </p>
            {p.severity_evidence ? (
              <blockquote>{p.severity_evidence}</blockquote>
            ) : null}
          </div>
        ) : null}
        <dl className="record-meta">
          <div>
            <dt>Event</dt>
            <dd>
              #{event.id} · Revision {event.revision}
            </dd>
          </div>
          <div>
            <dt>Added to Heist Feed</dt>
            <dd>
              <time dateTime={event.published_at}>
                {new Date(event.published_at).toUTCString()}
              </time>
            </dd>
          </div>
          {event.source_published_at ? (
            <div>
              <dt>Publisher date</dt>
              <dd>
                <time dateTime={event.source_published_at}>
                  {new Date(event.source_published_at).toUTCString()}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>
        <a href={event.source_url}>Read the original announcement ↗</a>
      </div>
    </details>
  );
}
