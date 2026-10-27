"use client";
import Link from "next/link";
import type { ReactNode } from "react";
import { Search, X } from "lucide-react";
import { filterQuery, type Filters } from "@/presentation/filters";
import {
  itemKinds,
  type ItemKind,
  severities,
  severityLabel,
  type Severity,
} from "@/domain/feed-item";
import { MultiSelectFilter } from "./multi-select-filter";
import { TechnologyFilter } from "./technology-filter";
import { useAutoFilters } from "./use-auto-filters";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { FeedSkeleton } from "./feed-skeleton";

export function FeedFilters({
  initialFilters,
  children,
}: {
  initialFilters: Filters;
  children: ReactNode;
}) {
  const { filters, update, pending } = useAutoFilters(
    Object.fromEntries(filterQuery(initialFilters)),
    "/",
  );
  return (
    <>
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
        <MultiSelectFilter
          name="type"
          label="Type"
          legend="Event type (matches any selected)"
          options={itemKinds.map((value) => ({
            value,
            label: value[0].toUpperCase() + value.slice(1),
          }))}
          selected={(filters.type?.split(",") ?? []) as ItemKind[]}
          onChange={(values) => update({ type: values.join(",") })}
        />
        <MultiSelectFilter
          name="severity"
          label="Severity"
          legend="Severity reported by the source"
          options={severities.map((value) => ({
            value,
            label: severityLabel(value),
          }))}
          selected={(filters.severity?.split(",") ?? []) as Severity[]}
          onChange={(values) => update({ severity: values.join(",") })}
        />
        <TechnologyFilter
          selected={filters.technology?.split(",").filter(Boolean) ?? []}
          onChange={(values) => update({ technology: values.join(",") })}
        />
        {Object.entries(filters).some(([, value]) => value) ? (
          <Button asChild variant="ghost" size="sm">
            <Link
              href="/"
              onNavigate={(event) => {
                event.preventDefault();
                update(
                  Object.fromEntries(
                    Object.keys(filters).map((key) => [key, ""]),
                  ),
                );
              }}
            >
              <X aria-hidden="true" />
              Reset filters
            </Link>
          </Button>
        ) : null}
      </form>
      {pending ? <FeedSkeleton /> : children}
    </>
  );
}
