import { db } from "./db";
import { technologySearch } from "./technology";
import type { TechnologyOption } from "./technology";

export async function catalogOptions(
  search = "",
  selected: string[] = [],
): Promise<TechnologyOption[]> {
  let query = db()
    .from("technology_catalog")
    .select("value:id,label")
    .order("label", { ascending: true })
    .order("id", { ascending: true })
    .limit(50);
  if (search)
    query = query.textSearch("search_document", technologySearch(search), {
      config: "simple",
    });
  const { data, error } = await query;
  if (error) throw error;
  const choices = (data ?? []) as TechnologyOption[];
  const missing = selected.filter(
    (id) => !choices.some((option) => option.value === id),
  );
  if (missing.length) {
    const extra = await db()
      .from("technology_catalog")
      .select("value:id,label")
      .in("id", missing)
      .limit(10);
    if (extra.error) throw extra.error;
    choices.push(...(extra.data ?? []));
  }
  return choices;
}
