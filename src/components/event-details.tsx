import type { FeedEvent } from "@/lib/events";
import { severityLabel } from "@/lib/priority";
type Fact = { value: string; evidence: string };
function Evidence({
  value,
  structured,
}: {
  value: string;
  structured: boolean;
}) {
  return structured ? (
    <p>
      Source reference: <code>{value}</code>
    </p>
  ) : (
    <blockquote>{value}</blockquote>
  );
}
function Facts({
  label,
  facts,
  structured,
}: {
  label: string;
  facts: Fact[];
  structured: boolean;
}) {
  return (
    <div className="fact-group">
      <dt>{label}</dt>
      <dd>
        {facts.length ? (
          facts.map((fact, i) => (
            <div className="fact" key={i}>
              <strong>{fact.value}</strong>
              <Evidence value={fact.evidence} structured={structured} />
            </div>
          ))
        ) : (
          <span className="unspecified">
            {structured
              ? "Not stated in this record"
              : "Not stated in this extraction"}
          </span>
        )}
      </dd>
    </div>
  );
}
export function EventDetails({ event }: { event: FeedEvent }) {
  const p = event.payload;
  const structured = event.extraction_method === "structured";
  return (
    <details className="event-details">
      <summary>
        Evidence and details <span aria-hidden="true">+</span>
      </summary>
      <div className="event-details-body">
        <p className="detail-disclaimer">
          {structured
            ? "Imported from structured advisory data. Source references identify upstream records or fields; verify affected versions and your deployed configuration."
            : "These are machine-extracted claims. Quotations show the recorded source text; verify the original announcement before acting."}
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
                  "/?before=" +
                  (p.supersedes_event_id + 1) +
                  "#event-" +
                  p.supersedes_event_id
                }
              >
                View the preceding event
              </a>
            ) : null}
          </div>
        ) : null}
        {p.evidence ? (
          <div className="supporting-quote">
            <h4>Security context</h4>
            <Evidence value={p.evidence} structured={structured} />
          </div>
        ) : null}
        {p.products.map((product, i) => (
          <section className="product-evidence" key={i}>
            <h4>{product.name.value}</h4>
            <Evidence value={product.name.evidence} structured={structured} />
            <dl>
              <Facts
                label="Affected versions"
                facts={product.affected_versions}
                structured={structured}
              />
              <Facts
                label="Fixed versions"
                facts={product.fixed_versions}
                structured={structured}
              />
              <Facts
                label="Prerequisites"
                facts={product.prerequisites}
                structured={structured}
              />
            </dl>
          </section>
        ))}
        {p.related_cves.length ? (
          <dl>
            <Facts
              label="Related CVEs"
              facts={p.related_cves}
              structured={structured}
            />
          </dl>
        ) : null}
        {event.extraction_method !== "system" ? (
          <div className="severity-evidence">
            <h4>Publisher severity</h4>
            <p>
              {p.severity === "unknown"
                ? structured
                  ? "No explicit severity was provided."
                  : "No explicit severity was extracted."
                : p.severity}
            </p>
            {p.severity_evidence ? (
              <Evidence value={p.severity_evidence} structured={structured} />
            ) : null}
          </div>
        ) : null}
        {event.priority?.linked_cves.length ? (
          <section className="linked-ratings">
            <h4>Linked CVE context</h4>
            <p>
              These ratings describe the referenced vulnerabilities and
              products. They are not a severity rating for every application
              using this dependency.
            </p>
            {event.priority.linked_cves.map((link, i) => (
              <div key={i}>
                <a href={link.source_url}>
                  {link.cve} · {severityLabel(link.severity)}
                </a>
                <p>
                  {link.products.map((p) => p.name.value).join(", ")}
                  {link.known_exploited ? " · Known exploited (CISA KEV)" : ""}
                </p>
                {link.relationship === "fixes" ? (
                  <>
                    <strong>Fix relationship</strong>
                    <blockquote>{link.relationship_evidence}</blockquote>
                  </>
                ) : null}
              </div>
            ))}
          </section>
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
        <a href={event.source_url}>Read the original announcement</a>
      </div>
    </details>
  );
}
