import { db } from "./db";
import type { FeedEvent } from "./events";
import type { EventQuery } from "./filters";
import { isStructured } from "./structured/config";
import { advisoryPath } from "./item-links";

export type AdvisoryGroup = {
  id: string;
  revision: number;
  primary_event_id: number;
  change: "published" | "updated" | "context" | "membership";
  superseded_by: string[];
  changed: FeedEvent;
  members: FeedEvent[];
};
type GroupRow = {
  id: number;
  group_id: string;
  revision: number;
  published_at: string;
  primary: FeedEvent;
} & Pick<AdvisoryGroup, "change" | "superseded_by" | "changed" | "members">;

export function publicEvent(row: FeedEvent): FeedEvent {
  return {
    ...row,
    detail_url: "/events/" + row.id,
    extraction_method:
      isStructured(row.source_id) &&
      row.payload.structured &&
      row.extraction_method !== "system"
        ? "structured"
        : row.extraction_method,
  };
}

export async function groupedEvents(
  options: Partial<EventQuery>,
  updates = false,
): Promise<FeedEvent[]> {
  const { limit, after, before, view: _view, type, ...filters } = options;
  const { data, error } = await db().rpc(
    updates || after !== undefined
      ? "query_advisory_updates"
      : "query_advisory_current",
    {
      filters: {
        ...filters,
        ...(type?.length ? { type: type.join(",") } : {}),
      },
      p_limit: limit ?? 30,
      p_after: after ?? null,
      p_before: before ?? null,
    },
  );
  if (error) throw error;
  return (data as GroupRow[]).map((row) => ({
    ...publicEvent(row.primary),
    // In view=grouped, id/published_at identify the group update. Source event
    // identities and dates remain intact in group.members and primary_event_id.
    id: row.id,
    published_at: row.published_at,
    group_id: row.group_id,
    detail_url: advisoryPath(row.group_id),
    context_update: row.change === "context",
    group: {
      id: row.group_id,
      revision: row.revision,
      primary_event_id: row.primary.id,
      change: row.change,
      superseded_by: row.superseded_by,
      changed: publicEvent(row.changed),
      members: row.members.map(publicEvent),
    },
  }));
}
