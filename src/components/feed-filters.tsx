"use client";
import { eventTypes, filterQuery, type Filters } from "@/lib/filters";
import type { Severity } from "@/lib/priority";
import type { TechnologyOption } from "@/lib/technology-options";
import { SeverityFilter } from "./severity-filter";
import { TechnologyFilter } from "./technology-filter";
import { useAutoFilters } from "./use-auto-filters";

export function FeedFilters({
  initialFilters,
  technologies,
}: {
  initialFilters: Filters;
  technologies: TechnologyOption[];
}) {
  const { filters, update, pending } = useAutoFilters(
    Object.fromEntries(filterQuery(initialFilters)),
    "/",
  );
  return (
    <form
      className="filters feed-filters"
      action="/"
      role="search"
      aria-label="Filter the feed"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        update({});
      }}
    >
      {filters.view ? (
        <input type="hidden" name="view" value={filters.view} />
      ) : null}
      {filters.group ? (
        <input type="hidden" name="group" value={filters.group} />
      ) : null}
      <input
        className="feed-search"
        type="search"
        name="q"
        aria-label="Search feed"
        placeholder="Search advisories, CVEs, products…"
        value={filters.q ?? ""}
        onChange={(event) => update({ q: event.target.value }, 300)}
        maxLength={120}
      />
      <select
        className="type-filter"
        name="type"
        aria-label="Type"
        value={filters.type ?? ""}
        onChange={(event) => update({ type: event.target.value })}
      >
        <option value="">All types</option>
        {eventTypes.map((type) => (
          <option key={type} value={type}>
            {type[0].toUpperCase() + type.slice(1)}
          </option>
        ))}
      </select>
      <SeverityFilter
        selected={(filters.severity?.split(",") ?? []) as Severity[]}
        onChange={(values) => update({ severity: values.join(",") })}
      />
      <TechnologyFilter
        selected={filters.technology?.split(",").filter(Boolean) ?? []}
        initialOptions={technologies}
        onChange={(values) => update({ technology: values.join(",") })}
      />
      {Object.entries(filters).some(
        ([key, value]) => key !== "view" && value,
      ) ? (
        <div className="filter-actions">
          <a href="/">Reset filters</a>
        </div>
      ) : null}
    </form>
  );
}
