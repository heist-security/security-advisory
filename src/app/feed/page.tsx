import { permanentRedirect } from "next/navigation";
import { pageParams, type SearchParams } from "@/presentation/filters";

export default async function FeedRedirect({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = pageParams(await searchParams);
  permanentRedirect("/" + (params.size ? "?" + params : ""));
}
