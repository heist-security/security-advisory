import { unstable_cache } from "next/cache";
import { events } from "./events";
// Public data only. Canonical parsed arguments are the cache key, shared by HTML, RSS and JSON.
export const cachedEvents = unstable_cache(events, ["public-events-v2"], { revalidate: 60 });
