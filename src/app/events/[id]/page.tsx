import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadSourceEvent } from "@/lib/advisory-detail";
import { returnToFeed } from "@/lib/item-links";
import type { SearchParams } from "@/lib/filters";
import type { FeedEvent } from "@/lib/events";
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
  const event = await loadSourceEvent((await params).id).catch(() => null);
  return { title: event?.payload.title ?? "Source revision" };
}
export default async function SourceEventPage({ params, searchParams }: Props) {
  const { id } = await params;
  const returnTo = returnToFeed((await searchParams).from);
  let event: FeedEvent | null;
  try {
    event = await loadSourceEvent(id);
  } catch {
    return (
      <DetailUnavailable
        href={"/events/" + encodeURIComponent(id)}
        returnTo={returnTo}
      />
    );
  }
  if (!event) notFound();
  return <AdvisoryDetail event={event} returnTo={returnTo} />;
}
