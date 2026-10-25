import { db } from "./db";
import { technologySearch } from "./technology";
import type { TechnologyOption } from "./technology-options";

export async function catalogOptions(search = ""): Promise<TechnologyOption[]> {
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
  return data ?? [];
}
