import { eventTypes, type Filters } from "@/lib/filters";
export function FeedFilters({ filters }: { filters: Filters }) {
  return (
    <form className="filters" action="/" aria-label="Filter the unified feed">
      {filters.q ? <input type="hidden" name="q" value={filters.q}/> : null}
      <label>
        Event type
        <select name="type" defaultValue={filters.type ?? ""}>
          <option value="">All types</option>
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>
      <label>
        Technology
        <input
          name="technology"
          placeholder="e.g. Node.js or Ruby"
          maxLength={100}
          defaultValue={filters.technology ?? ""}
        />
      </label>
      <label>
        CVE
        <input
          name="cve"
          placeholder="CVE-2026-12345"
          maxLength={28}
          defaultValue={filters.cve ?? ""}
        />
      </label>
      <label>
        Source ID
        <input
          name="source"
          placeholder="All sources"
          maxLength={150}
          defaultValue={filters.source ?? ""}
        />
      </label>
      <button className="button primary" type="submit">
        Apply filters →
      </button>
    </form>
  );
}
