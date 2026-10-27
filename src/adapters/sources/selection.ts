import sources from "../../../sources/registry.json";

// Empty remains safe for local/Preview builds. "all" is an explicit production opt-in.
export function selectedVendorIds(value = process.env.VENDOR_SOURCE_IDS ?? "") {
  if (value.trim() === "all") return sources.map((source) => source.id);
  const ids = [
    ...new Set(
      value
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
  if (ids.some((id) => !sources.some((source) => source.id === id)))
    throw new Error("Unknown vendor source ID");
  return ids;
}
