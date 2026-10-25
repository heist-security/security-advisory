"use client";
import { Search, X } from "lucide-react";
import { eventTypes, filterQuery, type Filters } from "@/lib/filters";
import type { Severity } from "@/lib/priority";
import type { TechnologyOption } from "@/lib/technology-options";
import { SeverityFilter } from "./severity-filter";
import { TechnologyFilter } from "./technology-filter";
import { useAutoFilters } from "./use-auto-filters";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

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
      className="feed-filters flex flex-wrap items-center gap-2 pb-6"
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
      <div className="relative min-w-0 basis-full md:flex-1">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          className="feed-search pl-9"
          type="search"
          name="q"
          aria-label="Search feed"
          placeholder="Search advisories, CVEs, products…"
          value={filters.q ?? ""}
          onChange={(event) => update({ q: event.target.value }, 300)}
          maxLength={120}
        />
      </div>
      <NativeSelect
        className="type-filter min-w-32"
        name="type"
        aria-label="Type"
        value={filters.type ?? ""}
        onChange={(event) => update({ type: event.target.value })}
      >
        <NativeSelectOption value="">All types</NativeSelectOption>
        {eventTypes.map((type) => (
          <NativeSelectOption key={type} value={type}>
            {type[0].toUpperCase() + type.slice(1)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
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
        <Button asChild variant="ghost" size="sm">
          <a href="/">
            <X aria-hidden="true" />
            Reset filters
          </a>
        </Button>
      ) : null}
    </form>
  );
}
