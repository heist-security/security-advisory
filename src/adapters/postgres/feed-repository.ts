import type { FeedRepository, Publication } from "../../application/ports";
import {
  publicItem,
  type FeedQuery,
  type StoredItem,
} from "../../domain/feed-item";
import { identityKeys, unique } from "../../domain/identity";
import {
  technologyKey,
  technologyLabel,
  matchingTechnologyFamilies,
  type TechnologyOption,
} from "../../domain/technology";
import type { Database, SqlClient } from "./client";
const columns = [
  "id",
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
            : `kind=any(${bind(query.type)}::text[])`,
        );
      if (query.severity?.length)
        where.push(
          updates
            ? `severity_keys && ${bind(query.severity)}::text[]`
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
      if (query.after !== undefined) where.push(`cursor>${bind(query.after)}`);
      if (query.before !== undefined)
        where.push(`cursor<${bind(query.before)}`);
      const { rows } = await db.query<{ item: StoredItem }>(
        `select to_jsonb(f)-'search_document' item from feed_items f where ${where.join(" and ")} order by cursor ${query.after !== undefined ? "asc" : "desc"} limit ${bind(query.limit)}`,
        values,
      );
      return rows.map((r) => publicItem(r.item));
    },
    async find(id) {
      await ready(db);
      const { rows } = await db.query<{ item: StoredItem }>(
        "select to_jsonb(f)-'search_document' item from feed_items f where id=$1",
        [id],
      );
      return rows[0] ? publicItem(rows[0].item) : null;
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
          const later = await client.query(
            "select id from documents where source_id=$1 and source_url=$2 and id>$3 and extraction_result is not null limit 1",
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
        const ids = command.records.map((r) => r.id),
          keys = unique(command.records.flatMap(identityKeys));
        const prior = await client.query<{ identity_keys: string[] }>(
          "select identity_keys from feed_items where active and record_ids && $1::text[]",
          [ids],
        );
        const scopeKeys = unique([
          ...keys,
          ...prior.rows.flatMap((r) => r.identity_keys),
        ]);
        const scope = await client.query<{ item: StoredItem }>(
          "select to_jsonb(f)-'search_document' item from feed_items f where identity_keys && $1::text[] or record_ids && $2::text[]",
          [scopeKeys, ids],
        );
        const items = update(scope.rows.map((r) => r.item));
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
    async technologies(search, selected = []) {
      await ready(db);
      // Catalog values come from the canonical table, not another maintained projection.
      const { rows } = await db.query<{ value: string; label: string }>(
        `select distinct key value,key label from feed_items f cross join lateral unnest(technology_ids) key
        where active and ($1='' or key ilike '%'||$1||'%' or key=any($2::text[])) order by key limit 60`,
        [
          technologyKey(search),
          [...selected, ...matchingTechnologyFamilies(search)],
        ],
      );
      const choices: TechnologyOption[] = rows.map(({ value }) => ({
        value,
        label: technologyLabel(value) ?? value,
      }));
      for (const value of selected)
        if (!choices.some((c) => c.value === value))
          choices.push({ value, label: value });
      return choices;
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
