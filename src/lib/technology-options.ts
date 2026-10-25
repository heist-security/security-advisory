import {
  technologyFamily,
  technologyLabel,
  technologyMatches,
} from "./technology";
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
    for (const raw of row.technologies) {
      if (["core-cve", "core-osv", "core-kev"].includes(raw)) continue;
      const key = technologyFamily(raw);
      if (!labels.has(key)) labels.set(key, technologyLabel(key) ?? key);
    }
    const products = row.products ?? row.payload?.products;
    if (Array.isArray(products))
      for (const p of products)
        if (typeof p?.name?.value === "string")
          labels.set(
            technologyFamily(p.name.value),
            technologyLabel(p.name.value) ?? p.name.value,
          );
  }
  return [...labels]
    .filter(
      ([value]) => value.length <= 100 && technologyMatches(value, search),
    )
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
    .slice(0, 50);
}
