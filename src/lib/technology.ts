import catalog from "./technology-families.json";

export function technologyKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\+/g, "-plus-")
    .replace(/#/g, "-sharp-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
const families = catalog.map((family) => ({
  ...family,
  match: new RegExp(family.pattern),
}));
export function technologyFamily(value: string) {
  const key = technologyKey(value);
  return families.find((family) => family.match.test(key))?.key ?? key;
}
export function technologyLabel(value: string) {
  return families.find((family) => family.key === technologyFamily(value))
    ?.label;
}
export function technologyMatches(value: string, search: string) {
  const key = technologyKey(search);
  const family = families.find(
    (entry) => entry.key === technologyFamily(value),
  );
  return (
    !key ||
    value.includes(key) ||
    (family &&
      (family.key === technologyFamily(search) ||
        family.aliases.some((alias) => alias.includes(key))))
  );
}
export function technologySearch(value: string) {
  const key = technologyKey(value);
  const family = families.find((entry) => entry.key === technologyFamily(key));
  const terms = family ? family.aliases : [key];
  return terms
    .map(
      (term) =>
        "(" +
        term
          .split("-")
          .map((word) => word + ":*")
          .join(" & ") +
        ")",
    )
    .join(" | ");
}
