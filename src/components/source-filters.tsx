"use client";
import { useAutoFilters } from "./use-auto-filters";

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
      className="filters catalog-filters"
      action="/sources"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        update({});
      }}
    >
      {filters.catalog ? (
        <input type="hidden" name="catalog" value={filters.catalog} />
      ) : null}
      <label>
        Search
        <input
          name="q"
          placeholder="Search sources…"
          value={filters.q}
          onChange={(event) => update({ q: event.target.value }, 300)}
          maxLength={100}
        />
      </label>
      <label>
        Channel
        <select
          name="channel"
          value={filters.channel}
          onChange={(event) => update({ channel: event.target.value })}
        >
          <option value="">All channels</option>
          <option value="security-advisories">Advisories</option>
          <option value="mixed-announcements">Mixed announcements</option>
          <option value="release-notes">Release notes</option>
        </select>
      </label>
      <label>
        Category
        <select
          name="category"
          value={filters.category}
          onChange={(event) => update({ category: event.target.value })}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>
    </form>
  );
}
