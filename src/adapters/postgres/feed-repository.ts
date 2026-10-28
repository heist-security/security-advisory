import type { FeedRepository, Publication } from "../../application/ports";
import type { FeedItem, FeedQuery, StoredItem } from "../../domain/feed-item";
import { identityKeys, unique } from "../../domain/identity";
import {
  technologyKey,
  technologyLabel,
  matchingTechnologyFamilies,
  type TechnologyOption,
} from "../../domain/technology";
import type { Database, SqlClient } from "./client";
const publicColumns = [
  "id",
  "cursor",
  "revision",
  "created_at",
  "updated_at",
  "source_published_at",
  "active",
  "replaced_by",
  "kind",
  "title",
  "summary",
  "product_names",
  "affected_versions",
  "fixed_versions",
  "cve_ids",
  "fixed_cve_ids",
  "technology_ids",
  "source_ids",
  "source_urls",
  "severity",
  "cvss",
  "known_exploited",
  "fix_available",
  "important",
  "records",
] satisfies (keyof FeedItem)[];
const columns = [
  ...publicColumns.filter((column) => column !== "cursor"),
  "record_ids",
  "identity_keys",
  "type_keys",
  "severity_keys",
  "cve_keys",
  "technology_keys",
  "source_keys",
  "fix_key",
  "important_key",
];
const publicProjection = publicColumns.map((column) => `f.${column}`).join(",");
async function completeDocument(
  client: SqlClient,
  document: NonNullable<Publication["document"]>,
) {
  const { job, normalized } = document;
  await client.query(
    "update documents set status='done',extraction_result=$2::jsonb,extraction_method=$3,extraction_model=$4,lease_token=null,leased_until=null,last_error=null where id=$1",
    [
      job.id,
      JSON.stringify(normalized.payload),
      normalized.method,
      normalized.model,
    ],
  );
}
async function ready(client: SqlClient) {
  const { rows } = await client.query<{ ready: boolean }>(
    "select completed_at is not null ready from feed_migration",
  );
  if (!rows[0]?.ready) throw new Error("Feed migration in progress");
}
export function feedRepository(db: Database): FeedRepository {
  return {
    async list(query: FeedQuery, changes = false) {
      await ready(db);
      const updates = changes || query.after !== undefined,
        values: unknown[] = [];
      const bind = (value: unknown) => {
        values.push(value);
        return "$" + values.length;
      };
      const where = [updates ? "true" : "active"];
      if (query.type?.length)
        where.push(
          updates
            ? `type_keys && ${bind(query.type)}::text[]`
            : query.type.length === 1
              ? `kind=${bind(query.type[0])}`
              : `kind=any(${bind(query.type)}::text[])`,
        );
      if (query.severity?.length)
        where.push(
          updates
            ? `severity_keys && ${bind(query.severity)}::text[]`
            : query.severity.length === 1
              ? `severity=${bind(query.severity[0])}`
              : `severity=any(${bind(query.severity)}::text[])`,
        );
      if (query.technology)
        where.push(
          `${updates ? "technology_keys" : "technology_ids"} && ${bind(query.technology.split(","))}::text[]`,
        );
      if (query.source)
        where.push(
          `${updates ? "source_keys" : "source_ids"} @> ${bind([query.source])}::text[]`,
        );
      if (query.cve)
        where.push(
          `${updates ? "cve_keys" : "cve_ids"} @> ${bind([query.cve])}::text[]`,
        );
      if (query.fix) where.push(updates ? "fix_key" : "fix_available");
      if (query.important) where.push(updates ? "important_key" : "important");
      if (query.q)
        where.push(
          `search_document @@ plainto_tsquery('simple',${bind(query.q)})`,
        );
      // These single predicates have B-tree indexes in cursor order. In
      // particular, equality (not ANY) lets (kind,cursor)/(severity,cursor)
      // provide the order without walking unrelated, more recent items.
      const filterCount = where.length - 1;
      const orderedIndex =
        filterCount === 0 ||
        (filterCount === 1 &&
          (query.fix ||
            query.important ||
            (!updates &&
              (query.type?.length === 1 || query.severity?.length === 1))));
      const bounds = [where[0]];
      if (query.after !== undefined) bounds.push(`cursor>${bind(query.after)}`);
      if (query.before !== undefined)
        bounds.push(`cursor<${bind(query.before)}`);
      where.push(...bounds.slice(1));
      const direction = query.after !== undefined ? "asc" : "desc";
      const limit = bind(query.limit);
      // Try a bounded recent window for common filters. If it cannot fill a
      // page, resolve all matching cursors independently of LIMIT so PostgreSQL
      // can use the filter indexes instead of scanning unrelated recent rows.
      // The count guards skip the full search when the window fills the page;
      // a partial window is replaced entirely to preserve pagination/order.
      // Only load full public records after choosing the page's cursors.
      const sql = orderedIndex
        ? `select to_jsonb(item) item from (
            select ${publicProjection} from feed_items f
            where ${where.join(" and ")} order by f.cursor ${direction} limit ${limit}
          ) item`
        : `with recent as materialized (
            select cursor from feed_items where ${bounds.join(" and ")}
            order by cursor ${direction} limit ${bind(query.limit * 4)}
          ), recent_matches as materialized (
            select f.cursor from recent r join feed_items f using(cursor)
            where ${where.join(" and ")} order by f.cursor ${direction} limit ${limit}
          ), matching as materialized (
            select cursor from feed_items where ${where.join(" and ")}
            and (select count(*) from recent_matches)<${limit}
          ), page as materialized (
            select cursor from recent_matches where (select count(*) from recent_matches)=${limit}
            union all
            (select cursor from matching order by cursor ${direction} limit ${limit})
          )
          select to_jsonb(item) item from (
            select ${publicProjection} from page p join feed_items f using(cursor)
            order by p.cursor ${direction}
          ) item`;
      const { rows } = await db.query<{ item: FeedItem }>(sql, values);
      return rows.map((r) => r.item);
    },
    async find(id) {
      await ready(db);
      const { rows } = await db.query<{ item: FeedItem }>(
        `select to_jsonb(item) item from (select ${publicProjection} from feed_items f where id=$1) item`,
        [id],
      );
      return rows[0]?.item ?? null;
    },
    async publish(command: Publication, update) {
      await db.transaction(async (client) => {
        // One commit order for feed cursors and claims; business rules run in
        // the injected domain operation, on a consistent publication scope.
        await client.query("select pg_advisory_xact_lock(719432001)");
        if (command.document) {
          await ready(client);
          const { job } = command.document;
          const { rows } = await client.query<{ id: number }>(
            "select id from documents where id=$1 and status='processing' and lease_token=$2 and leased_until>now() for update",
            [job.id, job.lease_token],
          );
          if (!rows.length) throw new Error("Lease expired or replaced");
          // Legacy non-security completions have no extraction JSON or event,
          // but their durable done status still fences older source revisions.
          const later = await client.query(
            "select id from documents where source_id=$1 and source_url=$2 and id>$3 and (extraction_result is not null or status='done') limit 1",
            [job.source_id, job.source_url, job.id],
          );
          if (later.rows.length) {
            await completeDocument(client, command.document);
            return;
          }
        } else {
          const checkpoint = await client.query<{
            last_event_id: string;
            completed_at: string | null;
          }>(
            "select last_event_id,completed_at from feed_migration for update",
          );
          if (command.migration_cursor === undefined)
            throw new Error("Migration checkpoint required");
          if (
            checkpoint.rows[0].completed_at ||
            Number(checkpoint.rows[0].last_event_id) >= command.migration_cursor
          )
            return;
        }
        // Retained keys can connect several former groups. Reconciliation needs
        // every reachable peer, including conflicts beyond the initial anchor.
        const scope = new Map<string, StoredItem>(),
          seenKeys = new Set<string>();
        let keys = unique(command.records.flatMap(identityKeys));
        while (keys.length) {
          for (const key of keys) seenKeys.add(key);
          const { rows } = await client.query<{ item: StoredItem }>(
            "select to_jsonb(f)-'search_document' item from feed_items f where identity_keys && $1::text[] and id<>all($2::text[])",
            [keys, [...scope.keys()]],
          );
          keys = [];
          for (const { item } of rows) {
            scope.set(item.id, item);
            keys.push(
              ...item.identity_keys.filter((key) => !seenKeys.has(key)),
            );
          }
          keys = unique(keys);
        }
        const items = update([...scope.values()]);
        if (items.length)
          await client.query(
            `insert into feed_items(${columns.join(",")})
          select ${columns.join(",")} from jsonb_populate_recordset(null::feed_items,$1::jsonb) order by id
          on conflict(id) do update set ${columns
            .filter((c) => c !== "id")
            .map((c) => `${c}=excluded.${c}`)
            .join(",")},cursor=excluded.cursor`,
            [JSON.stringify(items)],
          );
        if (command.document) {
          await completeDocument(client, command.document);
        } else {
          await client.query(
            "update documents d set extraction_result=r.payload,extraction_method=r.method from jsonb_to_recordset($1::jsonb) r(document_id bigint,payload jsonb,method text) where d.id=r.document_id and d.extraction_result is null",
            [JSON.stringify(command.records)],
          );
          await client.query("update feed_migration set last_event_id=$1", [
            command.migration_cursor,
          ]);
        }
      });
    },
    async technologies({ q, after, limit }) {
      await ready(db);
      const values: unknown[] = [],
        where: string[] = [];
      const bind = (value: unknown) => {
        values.push(value);
        return "$" + values.length;
      };
      if (q)
        where.push(
          `(value like ${bind("%" + technologyKey(q) + "%")} or value=any(${bind(matchingTechnologyFamilies(q))}::text[]))`,
        );
      if (after) where.push(`value>${bind(after)}`);
      const { rows } = await db.query<{ value: string }>(
        `select value from feed_technologies ${where.length ? "where " + where.join(" and ") : ""} order by value limit ${bind(limit + 1)}`,
        values,
      );
      const choices: TechnologyOption[] = rows
        .slice(0, limit)
        .map(({ value }) => ({
          value,
          label: technologyLabel(value) ?? value,
        }));
      return {
        data: choices,
        next_after: rows.length > limit ? choices.at(-1)!.value : null,
      };
    },
    async sitemapParts() {
      await ready(db);
      return (
        await db.query<{ part: number }>(
          "select distinct ((cursor-1)/1000)::integer part from feed_items where active order by part limit 50000",
        )
      ).rows.map((r) => r.part);
    },
    async sitemapItems(after, through) {
      await ready(db);
      return (
        await db.query<{ id: string; cursor: number }>(
          "select id,cursor::float8 cursor from feed_items where active and cursor>$1 and cursor<=$2 order by cursor limit 1000",
          [after, through],
        )
      ).rows;
    },
  };
}
