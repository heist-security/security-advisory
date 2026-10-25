import { technologyKey } from "./filters";
export type TechnologyOption = { value: string; label: string };
type TechnologyRow = {
  technologies: string[];
  payload: { products: { name: { value: string } }[] };
};
export function technologyOptions(
  rows: TechnologyRow[],
  search = "",
): TechnologyOption[] {
  const labels = new Map<string, string>();
  for (const row of rows) {
    for (const key of row.technologies)
      if (!labels.has(key)) labels.set(key, key);
    for (const p of row.payload.products)
      labels.set(technologyKey(p.name.value), p.name.value);
  }
  const key = technologyKey(search);
  return [...labels]
    .filter(([value]) => value.length <= 100 && (!key || value.includes(key)))
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 50);
}
