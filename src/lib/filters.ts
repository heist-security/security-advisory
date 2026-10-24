export const eventTypes = [
  "advisory",
  "patch",
  "mitigation",
  "withdrawal",
  "other",
] as const;
export type EventType = (typeof eventTypes)[number];
export type Filters = {
  q?: string;
  type?: EventType;
  technology?: string;
  cve?: string;
  source?: string;
};
export type EventQuery = Filters & {
  after?: number;
  before?: number;
  limit: number;
};
export type SearchParams = Record<string, string | string[] | undefined>;
export function technologyKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\+/g, "-plus-")
    .replace(/#/g, "-sharp-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
export function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}
export function pageParams(values: SearchParams) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values))
    params.set(key, first(value).slice(0, 200));
  return params;
}
export function parseEventQuery(
  params: URLSearchParams,
  defaultLimit = 30,
): EventQuery {
  for (const key of [
    "q",
    "type",
    "kind",
    "technology",
    "cve",
    "source",
    "after",
    "before",
    "limit",
  ]) {
    if (params.getAll(key).length > 1)
      throw new Error("Repeated filter parameters are not supported");
  }
  const q = params.get("q")?.trim().replace(/\s+/g, " ") || undefined;
  if (q && (q.length > 120 || /[\x00-\x1F\x7F]/.test(q)))
    throw new Error("Search must be 1 to 120 printable characters");
  const type = params.get("type") || params.get("kind") || undefined;
  if (
    params.get("type") &&
    params.get("kind") &&
    params.get("type") !== params.get("kind")
  )
    throw new Error("Conflicting type and kind");
  if (type && !eventTypes.includes(type as EventType))
    throw new Error("Invalid event type");
  const rawTechnology = params.get("technology")?.trim();
  if (
    rawTechnology &&
    (rawTechnology.length > 100 || !technologyKey(rawTechnology))
  )
    throw new Error("Invalid technology");
  const cve = params.get("cve")?.trim().toUpperCase() || undefined;
  if (cve && !/^CVE-\d{4}-\d{4,19}$/.test(cve)) throw new Error("Invalid CVE");
  const source = params.get("source") || undefined;
  if (source && !/^[a-z0-9-]{1,150}$/.test(source))
    throw new Error("Invalid source");
  const integer = (key: string, fallback?: number) => {
    const raw = params.get(key);
    if (raw === null) return fallback;
    if (!/^\d{1,16}$/.test(raw) || !Number.isSafeInteger(Number(raw)))
      throw new Error("Invalid " + key);
    return Number(raw);
  };
  const after = integer("after"),
    before = integer("before"),
    limit = integer("limit", defaultLimit)!;
  if (after !== undefined && before !== undefined)
    throw new Error("Use after or before, not both");
  if (limit < 1 || limit > 100) throw new Error("Limit must be 1 to 100");
  return {
    q,
    type: type as EventType | undefined,
    technology: rawTechnology ? technologyKey(rawTechnology) : undefined,
    cve,
    source,
    after,
    before,
    limit,
  };
}
export function filterQuery(filters: Filters) {
  const params = new URLSearchParams();
  for (const key of ["q", "type", "technology", "cve", "source"] as const)
    if (filters[key]) params.set(key, filters[key]!);
  return params;
}
