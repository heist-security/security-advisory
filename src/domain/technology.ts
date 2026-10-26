import catalog from "./technology-families.json";

export type TechnologyOption = { value: string; label: string };

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
// Only explicit, separated versions are removable for arbitrary product names.
// Digits inside names (HTTP/2, log4j2, OAuth2, etc.) remain part of the identity.
export function technologyProductName(value: string) {
  return value
    .trim()
    .replace(
      /\s+(?:version\s+|v)?[0-9]+(?:\.[0-9]+){0,3}(?:\s+\(?(?:LTS|Current)\)?)?$/i,
      "",
    )
    .trim();
}
export function technologyFamily(value: string) {
  const key = technologyKey(technologyProductName(value));
  return families.find((family) => family.match.test(key))?.key ?? key;
}
export function technologyLabel(value: string) {
  return families.find((family) => family.key === technologyFamily(value))
    ?.label;
}
export function matchingTechnologyFamilies(search: string) {
  const key = technologyKey(search);
  return families
    .filter((family) => family.aliases.some((alias) => alias.includes(key)))
    .map((family) => family.key);
}

export function technologyMatches(value: string, search: string) {
  const key = technologyKey(search);
  return (
    !key ||
    value.includes(key) ||
    technologyFamily(value) === technologyFamily(search) ||
    matchingTechnologyFamilies(search).includes(technologyFamily(value))
  );
}
