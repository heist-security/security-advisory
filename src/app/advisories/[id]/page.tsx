import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { loadAdvisory } from "@/lib/advisory-detail";
import { events, type FeedEvent } from "@/lib/events";
import { advisoryPath, groupRouteId, returnToFeed } from "@/lib/item-links";
import type { SearchParams } from "@/lib/filters";
import {
  AdvisoryDetail,
  DetailUnavailable,
} from "@/components/advisory-detail";
export const dynamic = "force-dynamic";
type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadAdvisory((await params).id).catch(() => null);
  return { title: event?.payload.title ?? "Advisory details" };
}
export default async function AdvisoryPage({ params, searchParams }: Props) {
  const id = groupRouteId((await params).id);
  if (!id) notFound();
  const query = await searchParams;
  const returnTo = returnToFeed(query.from);
  const before = query.before === undefined ? undefined : Number(query.before);
  if (
    before !== undefined &&
    (typeof query.before !== "string" ||
      !/^\d{1,16}$/.test(query.before) ||
      !Number.isSafeInteger(before))
  )
    notFound();
  let event: FeedEvent | null;
  try {
    event = await loadAdvisory(id);
  } catch {
    return <DetailUnavailable href={advisoryPath(id)} returnTo={returnTo} />;
  }
  if (!event) notFound();
  if (event.group?.superseded_by.length === 1) {
    redirect(
      advisoryPath(event.group.superseded_by[0]) +
        (returnTo === "/" ? "" : "?" + new URLSearchParams({ from: returnTo })),
    );
  }
  let history: FeedEvent[] = [],
    historyAvailable = true;
  try {
    history = await events({ group: id, limit: 11, before });
  } catch {
    historyAvailable = false;
  }
  return (
    <AdvisoryDetail
      event={event}
      returnTo={returnTo}
      history={history}
      historyBefore={before}
      historyAvailable={historyAvailable}
    />
  );
}
