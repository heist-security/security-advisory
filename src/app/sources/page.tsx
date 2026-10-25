import type { Metadata } from "next";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { SourceFilters } from "@/components/source-filters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { sourcePage } from "@/lib/registry";
import { pageParams, type SearchParams } from "@/lib/filters";
export const metadata: Metadata = { title: "Sources" };
const channelLabels = {
  "security-advisories": "Advisories",
  "mixed-announcements": "Mixed announcements",
  "release-notes": "Release notes",
};
export default async function Sources({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = pageParams(await searchParams),
    result = sourcePage(params);
  const vendor = params.get("catalog") === "vendor";
  const link = (page: number) => {
    const next = new URLSearchParams(params);
    next.set("page", String(page));
    return "/sources?" + next;
  };
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-7xl space-y-6 px-4 py-6 sm:px-8"
    >
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-3 text-2xl font-semibold tracking-tight">
          Sources <Badge variant="secondary">{result.catalog_count}</Badge>
        </h1>
        <p className="text-sm text-muted-foreground">
          {result.catalog_channel_counts["security-advisories"]} advisory ·{" "}
          {result.catalog_channel_counts["mixed-announcements"]} mixed ·{" "}
          {result.catalog_channel_counts["release-notes"]} release-note streams
        </p>
      </header>
      <SourceFilters
        initialFilters={{
          q: (params.get("q") ?? "").slice(0, 100),
          channel: result.channel,
          category: result.category,
          catalog: vendor ? "vendor" : "",
        }}
        categories={result.catalog_categories}
      />
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-muted-foreground">
          {result.total} matching sources · Page {result.page} of {result.pages}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={vendor ? "/sources" : "/sources?catalog=vendor"}>
              {vendor ? "Configured sources" : "Optional vendor catalog"}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="sm">
            <Link href={vendor ? "/sources?catalog=vendor" : "/sources"}>
              Reset filters
            </Link>
          </Button>
        </div>
      </div>
      <div className="space-y-3">
        {result.rows.map((source) => (
          <Card className="source-row gap-3 py-4 shadow-none" key={source.id}>
            <CardHeader className="gap-3 px-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="min-w-0 text-base font-medium [overflow-wrap:anywhere]">
                  <a
                    className="hover:text-primary hover:underline"
                    href={source.homepage}
                  >
                    {source.name}
                  </a>
                </h2>
                <div className="flex flex-wrap gap-2">
                  <Badge className="source-category" variant="secondary">
                    {source.category}
                  </Badge>
                  <Badge className="source-channel" variant="outline">
                    {channelLabels[source.channel]}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="px-5">
              <Collapsible>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    asChild
                    variant="link"
                    size="sm"
                    className="h-auto px-0"
                  >
                    <a
                      href={source.feed_url}
                      aria-label={"Publisher feed for " + source.name}
                    >
                      Feed
                    </a>
                  </Button>
                  <Button asChild variant="link" size="sm">
                    <a
                      href={source.verification.sample_url}
                      aria-label={
                        (source.verification.checked_at
                          ? "Checked document for "
                          : "Data documentation for ") + source.name
                      }
                    >
                      {source.verification.checked_at ? "Sample" : "Docs"}
                    </a>
                  </Button>
                  <Button asChild variant="link" size="sm">
                    <Link href={"/?source=" + encodeURIComponent(source.id)}>
                      Events
                    </Link>
                  </Button>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="ml-auto [&[data-state=open]>svg]:rotate-180"
                      aria-label={
                        "Scope and verification notes for " + source.name
                      }
                    >
                      Details{" "}
                      <ChevronDown
                        aria-hidden="true"
                        className="transition-transform"
                      />
                    </Button>
                  </CollapsibleTrigger>
                </div>
                <CollapsibleContent>
                  <div className="mt-3 space-y-2 rounded-md bg-muted p-4 text-sm leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
                    <p className="source-check font-medium text-foreground">
                      {source.verification.checked_at ? (
                        <>
                          Checked{" "}
                          <time dateTime={source.verification.checked_at}>
                            {source.verification.checked_at.slice(0, 10)}
                          </time>
                        </>
                      ) : (
                        "Structured adapter"
                      )}{" "}
                      · Target interval {source.poll_interval_minutes} minutes
                    </p>
                    <p>{source.rationale}</p>
                    <p>{source.limitations}</p>
                    {source.verification.warnings.length ? (
                      <p>{source.verification.warnings.join("; ")}</p>
                    ) : null}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>
      {!result.total ? (
        <Card role="status" className="shadow-none">
          <CardContent className="text-sm text-muted-foreground">
            No sources match these filters.
          </CardContent>
        </Card>
      ) : null}
      <nav className="flex justify-between gap-3" aria-label="Source pages">
        {result.page > 1 ? (
          <Button asChild variant="outline">
            <Link href={link(result.page - 1)}>Previous</Link>
          </Button>
        ) : (
          <span />
        )}
        {result.page < result.pages ? (
          <Button asChild variant="outline">
            <Link href={link(result.page + 1)}>Next</Link>
          </Button>
        ) : null}
      </nav>
      <p className="text-xs leading-relaxed text-muted-foreground">
        Structured advisory databases are configured by default; vendor feeds
        are opt-in. Catalog entries do not establish live uptime or complete
        coverage. Vendor checks verify retrieval and parsing, not extraction
        accuracy.
      </p>
    </main>
  );
}
