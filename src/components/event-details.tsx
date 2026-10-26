import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "./ui/alert";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader } from "./ui/card";
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
    <p className="text-sm text-muted-foreground">
      Source reference: <code className="font-mono text-xs">{value}</code>
    </p>
  ) : (
    <blockquote className="my-3 border-l-2 border-primary/30 pl-4 text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
      {value}
    </blockquote>
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
    <div className="grid gap-2 py-3 sm:grid-cols-[140px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="min-w-0">
        {facts.length ? (
          facts.map((fact, i) => (
            <div className="space-y-2" key={i}>
              <strong className="font-mono text-xs font-medium">
                {fact.value}
              </strong>
              <Evidence value={fact.evidence} structured={structured} />
            </div>
          ))
        ) : (
          <span className="text-xs text-muted-foreground">
            {structured
              ? "Not stated in this record"
              : "Not stated in this extraction"}
          </span>
        )}
      </dd>
    </div>
  );
}
export function SourceDetails({
  event,
  primary = false,
}: {
  event: FeedEvent;
  primary?: boolean;
}) {
  const p = event.payload;
  const structured = event.extraction_method === "structured";
  return (
    <Card
      className="source-record scroll-mt-6 gap-4 shadow-none"
      id={"source-" + event.advisory_id}
    >
      <CardHeader className="space-y-2">
        <h2 className="text-xl font-semibold tracking-tight">
          <a href={event.source_url}>{p.structured?.id ?? event.source_id}</a>
        </h2>
        <p className="text-sm text-muted-foreground">
          {primary ? "Primary source · " : ""}Revision {event.revision}
          {p.kind === "withdrawal" ? " · Withdrawn" : ""}
        </p>
        {!primary ? (
          <>
            <h3>{p.title}</h3>
            <p className="text-sm leading-relaxed whitespace-pre-line text-muted-foreground">
              {p.summary}
            </p>
          </>
        ) : null}
      </CardHeader>
      <CardContent className="space-y-5 text-sm leading-relaxed [&_h3]:mb-2 [&_h3]:font-semibold [&_a]:text-primary [&_a:hover]:underline">
        <p className="detail-disclaimer text-muted-foreground">
          {structured
            ? "Imported from structured advisory data. Source references identify upstream records or fields; verify affected versions and your deployed configuration."
            : "These are machine-extracted claims. Quotations show the recorded source text; verify the original announcement before acting."}
        </p>
        {event.extraction_method === "system" ? (
          <Alert role="status" className="bg-muted">
            <AlertTitle>Correction to Heist’s extraction</AlertTitle>
            <AlertDescription>
              <p>
                This replaces the earlier extraction. It does not mean that the
                publisher withdrew its announcement.
              </p>
              {p.supersedes_event_id ? (
                <Link href={"/events/" + p.supersedes_event_id}>
                  View the preceding event
                </Link>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}
        {p.evidence ? (
          <div className="supporting-quote">
            <h3>Security context</h3>
            <Evidence value={p.evidence} structured={structured} />
          </div>
        ) : null}
        {p.products.map((product, i) => (
          <section className="border-t pt-5" key={i}>
            <h3>{product.name.value}</h3>
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
        {p.structured?.affected.length ? (
          <section className="space-y-3">
            <h3>Structured affected-version data</h3>
            <p>
              Original package identities and version rules from this source.
            </p>
            <pre className="max-w-full overflow-x-auto rounded-md border bg-muted p-4 font-mono text-xs">
              {JSON.stringify(p.structured.affected, null, 2)}
            </pre>
          </section>
        ) : null}
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
            <h3>Publisher severity</h3>
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
          <section className="linked-ratings space-y-3">
            <h3>Linked CVE context</h3>
            <p>
              These ratings describe the referenced vulnerabilities and
              products. They are not a severity rating for every application
              using this dependency.
            </p>
            {event.priority.linked_cves.map((link, i) => (
              <div key={i} className="space-y-2 rounded-md border p-4">
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
                    <blockquote className="border-l-2 border-primary/30 pl-4 text-muted-foreground">
                      {link.relationship_evidence}
                    </blockquote>
                  </>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}
        <dl className="space-y-3 border-y py-4 text-xs [&>div]:grid [&>div]:gap-2 sm:[&>div]:grid-cols-[140px_minmax(0,1fr)] [&_dt]:text-muted-foreground">
          <div>
            <dt>Event</dt>
            <dd className="min-w-0">
              #{event.id} · Revision {event.revision}
            </dd>
          </div>
          <div>
            <dt>Added to Heist Feed</dt>
            <dd className="min-w-0">
              <time dateTime={event.published_at}>
                {new Date(event.published_at).toUTCString()}
              </time>
            </dd>
          </div>
          {event.source_published_at ? (
            <div>
              <dt>Publisher date</dt>
              <dd className="min-w-0">
                <time dateTime={event.source_published_at}>
                  {new Date(event.source_published_at).toUTCString()}
                </time>
              </dd>
            </div>
          ) : null}
        </dl>
        <Button asChild variant="outline" size="sm">
          <a href={event.source_url}>Read the original announcement</a>
        </Button>
      </CardContent>
    </Card>
  );
}
