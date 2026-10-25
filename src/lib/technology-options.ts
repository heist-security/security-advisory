import { technologyKey } from "./filters";
export type TechnologyOption = { value: string; label: string };
type TechnologyRow = {
  technologies: string[];
  products?: unknown;
  payload?: { products?: unknown };
};
export function technologyOptions(
  rows: TechnologyRow[],
  search = "",
): TechnologyOption[] {
  const labels = new Map<string, string>();
  for (const row of rows) {
    for (const key of row.technologies)
      if (!labels.has(key)) labels.set(key, key);
    const products = row.products ?? row.payload?.products;
    if (Array.isArray(products))
      for (const p of products)
        if (typeof p?.name?.value === "string")
          labels.set(technologyKey(p.name.value), p.name.value);
  }
  const key = technologyKey(search);
  return [...labels]
    .filter(([value]) => value.length <= 100 && (!key || value.includes(key)))
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 50);
}
