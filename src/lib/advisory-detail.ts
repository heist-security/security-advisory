import { cache } from "react";
import { events, eventById } from "./events";
import { groupRouteId } from "./item-links";

export const loadAdvisory = cache(async (value: string) => {
  const id = groupRouteId(value);
  if (!id) return null;
  const current = await events({ view: "grouped", group: id, limit: 1 });
  if (current.length) return current[0];
  // Retired group URLs still resolve to their membership correction, allowing
  // the page to link or redirect to the current group instead of breaking links.
  return (
    (await events({ view: "grouped", group: id, limit: 1 }, true))[0] ?? null
  );
});
export const loadSourceEvent = cache(async (id: string) => {
  if (!/^[1-9][0-9]{0,15}$/.test(id) || !Number.isSafeInteger(Number(id)))
    return null;
  return eventById(Number(id));
});
