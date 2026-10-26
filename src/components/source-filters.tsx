"use client";
import { useAutoFilters } from "./use-auto-filters";
import { Input } from "./ui/input";
import { NativeSelect, NativeSelectOption } from "./ui/native-select";

export function SourceFilters({
  initialFilters,
  categories,
}: {
  initialFilters: {
    q: string;
    channel: string;
    category: string;
    catalog: string;
  };
  categories: string[];
}) {
  const { filters, update, pending } = useAutoFilters(
    initialFilters,
    "/sources",
  );
  return (
    <form
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr]"
      action="/sources"
      role="search"
      aria-label="Filter sources"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        update({});
      }}
    >
      {filters.catalog ? (
        <input type="hidden" name="catalog" value={filters.catalog} />
      ) : null}
      <label className="grid gap-2 text-sm font-medium sm:col-span-2 lg:col-span-1">
        Search
        <Input
          name="q"
          type="search"
          placeholder="Search sources…"
          value={filters.q}
          onChange={(event) => update({ q: event.target.value }, 300)}
          maxLength={100}
        />
      </label>
      <label className="grid gap-2 text-sm font-medium [&>div]:w-full">
        Channel
        <NativeSelect
          name="channel"
          value={filters.channel}
          onChange={(event) => update({ channel: event.target.value })}
        >
          <NativeSelectOption value="">All channels</NativeSelectOption>
          <NativeSelectOption value="security-advisories">
            Advisories
          </NativeSelectOption>
          <NativeSelectOption value="mixed-announcements">
            Mixed announcements
          </NativeSelectOption>
          <NativeSelectOption value="release-notes">
            Release notes
          </NativeSelectOption>
        </NativeSelect>
      </label>
      <label className="grid gap-2 text-sm font-medium [&>div]:w-full">
        Category
        <NativeSelect
          name="category"
          value={filters.category}
          onChange={(event) => update({ category: event.target.value })}
        >
          <NativeSelectOption value="">All categories</NativeSelectOption>
          {categories.map((category) => (
            <NativeSelectOption key={category}>{category}</NativeSelectOption>
          ))}
        </NativeSelect>
      </label>
    </form>
  );
}
