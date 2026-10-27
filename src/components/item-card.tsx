import Link from "next/link";
import type { FeedItem } from "@/domain/feed-item";
import type { Filters } from "@/presentation/filters";
import { technologyFamily } from "@/domain/technology";
import { feedLink, feedTimestamp } from "@/presentation/feed-view";
import { itemLink, summaryPreview } from "@/presentation/item-links";
import { itemDescription } from "@/presentation/item-description";
import { ItemBadges, ItemMetadata } from "./item-metadata";
import { Card, CardDescription, CardFooter, CardHeader } from "./ui/card";

import { ScoreBadges } from "./score-badges";
export function ItemCard({
  item,
  filters = {},
  returnTo = "/",
}: {
  item: FeedItem;
  filters?: Filters;
  returnTo?: string;
}) {
  const href = itemLink(item, returnTo);
  const description = itemDescription(item);
  const products = item.product_names.slice(0, 3);
  const cves = item.cve_ids.slice(0, 2);
  const versions = item.fixed_versions;
  const remaining =
    item.product_names.length +
    item.cve_ids.length -
    products.length -
    cves.length;
  return (
    <article
      className="item-card scroll-mt-4 [overflow-wrap:anywhere]"
      id={"item-" + item.id}
    >
      <Card className="gap-3 rounded-lg py-5 shadow-none">
        <CardHeader className="gap-2 px-5">
          <ItemBadges item={item}>
            {item.kind !== "withdrawal" ? (
              <ScoreBadges cvss={item.cvss} cves={item.cve_ids} />
            ) : null}
          </ItemBadges>
          <h3 className="text-lg leading-snug font-medium tracking-tight">
            <Link href={href} className="hover:text-primary">
              {description.title}
            </Link>
          </h3>
          <ItemMetadata item={item} filters={filters}>
            <time
              dateTime={item.updated_at}
              title="Latest feed update (UTC)"
              className="w-full text-xs tabular-nums text-muted-foreground sm:ml-auto sm:w-auto"
            >
              {feedTimestamp(item.updated_at)}
            </time>
          </ItemMetadata>
          {description.summary ? (
            <CardDescription className="text-sm leading-relaxed">
              <p className="item-summary line-clamp-2">
                {summaryPreview(description.summary)}
              </p>
            </CardDescription>
          ) : null}
        </CardHeader>
        {products.length || cves.length || versions.length || remaining > 0 ? (
          <CardFooter className="flex-wrap gap-x-4 gap-y-1 px-5 text-xs text-muted-foreground">
            {products.length ? (
              <span>
                Products:{" "}
                {products.map((product, i) => (
                  <span key={i}>
                    {i > 0 ? ", " : null}
                    <Link
                      className="hover:text-primary hover:underline"
                      href={feedLink({
                        ...filters,
                        technology: technologyFamily(product),
                      })}
                    >
                      {product}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}
            {cves.length ? (
              <span>
                CVEs:{" "}
                {cves.map((cve, i) => (
                  <span key={cve}>
                    {i > 0 ? ", " : null}
                    <Link
                      className="hover:text-primary hover:underline"
                      href={feedLink({ ...filters, cve: cve })}
                    >
                      {cve}
                    </Link>
                  </span>
                ))}
              </span>
            ) : null}
            {versions.length ? (
              <span>
                Fixed versions: {versions.slice(0, 6).join(", ")}
                {versions.length > 6 ? (
                  <Link href={href}> +{versions.length - 6} more</Link>
                ) : null}
              </span>
            ) : null}
            {remaining > 0 ? (
              <Link href={href} className="hover:text-primary hover:underline">
                +{remaining} more
              </Link>
            ) : null}
          </CardFooter>
        ) : null}
      </Card>
    </article>
  );
}
