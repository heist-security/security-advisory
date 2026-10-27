import Link from "next/link";
import { notFound } from "next/navigation";
import { services } from "@/server/services";
import { validItemId, returnToFeed, itemPath } from "@/presentation/item-links";
import { feedTimestamp } from "@/presentation/feed-view";
import { itemDescription } from "@/presentation/item-description";
import { ItemBadges, ItemMetadata } from "@/components/item-metadata";
import { ScoreBadges, ScoreProvider } from "@/components/score-badges";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import type { FeedItem } from "@/domain/feed-item";
export const dynamic = "force-dynamic";
export default async function Item({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { id } = await params,
    from = returnToFeed((await searchParams).from);
  if (!validItemId(id)) notFound();
  let item: FeedItem | null;
  try {
    item = await services().feed.find(id);
  } catch {
    return (
      <main id="main" className="mx-auto max-w-4xl p-8">
        <p role="status">Feed item temporarily unavailable.</p>
        <Link href={from}>Back to feed</Link>
      </main>
    );
  }
  if (!item) notFound();
  const description = itemDescription(item);
  return (
    <main
      id="main"
      className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:px-8"
    >
      <Link className="text-sm underline" href={from}>
        Back to feed
      </Link>
      <ScoreProvider cves={item.cve_ids}>
        <ItemBadges item={item}>
          {item.kind !== "withdrawal" && item.active ? (
            <ScoreBadges cvss={item.cvss} cves={item.cve_ids} />
          ) : null}
        </ItemBadges>
        <h1 className="text-3xl font-semibold tracking-tight">
          {description.title}
        </h1>
        <ItemMetadata item={item} />
        {description.summary ? (
          <p className="whitespace-pre-wrap text-muted-foreground">
            {description.summary}
          </p>
        ) : null}
      </ScoreProvider>
      {!item.active ? (
        <Card>
          <CardContent>
            <p>This item has been regrouped. Follow its current items:</p>
            {item.replaced_by.map((id) => (
              <Link className="mr-4 underline" key={id} href={itemPath({ id })}>
                Current item
              </Link>
            ))}
          </CardContent>
        </Card>
      ) : null}
      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        {[
          ["Products", item.product_names],
          ["Affected versions", item.affected_versions],
          ["Fixed versions", item.fixed_versions],
          ["CVEs", item.cve_ids],
          ["Confirmed fixed CVEs", item.fixed_cve_ids],
        ].map(([label, values]) => (
          <div key={label as string}>
            <dt className="font-medium">{label}</dt>
            <dd className="break-words text-muted-foreground">
              {(values as string[]).join(", ") || "Not specified"}
            </dd>
          </div>
        ))}
        <div>
          <dt className="font-medium">Updated in this feed</dt>
          <dd>
            {feedTimestamp(item.updated_at)} · Revision {item.revision}
          </dd>
        </div>
      </dl>
      <section className="space-y-4" aria-labelledby="evidence">
        <h2 id="evidence" className="text-xl font-semibold">
          Source evidence
        </h2>
        {item.records.map((record) => (
          <Card key={record.id} className="shadow-none">
            <CardHeader>
              <h3 className="font-medium">{record.payload.title}</h3>
              <a
                className="break-all text-sm underline"
                href={record.url}
                rel="noreferrer"
              >
                {record.source_id} · Original source
              </a>
              {record.published_at ? (
                <p className="text-xs text-muted-foreground">
                  Published {feedTimestamp(record.published_at)}
                </p>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{record.payload.summary}</p>
              <blockquote className="border-l-2 pl-4 text-muted-foreground">
                {record.payload.evidence}
              </blockquote>
              {record.payload.products.map((product, index) => (
                <div key={index}>
                  <p className="font-medium">{product.name.value}</p>
                  <p>
                    Fixed versions:{" "}
                    {product.fixed_versions.map((v) => v.value).join(", ") ||
                      "Not specified"}
                  </p>
                  {product.prerequisites.length ? (
                    <p>
                      Prerequisites:{" "}
                      {product.prerequisites.map((v) => v.value).join("; ")}
                    </p>
                  ) : null}
                </div>
              ))}
              <details>
                <summary className="cursor-pointer">
                  Complete source record
                </summary>
                <pre className="mt-3 overflow-x-auto rounded bg-muted p-3 text-xs">
                  {JSON.stringify(record, null, 2)}
                </pre>
              </details>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  );
}
