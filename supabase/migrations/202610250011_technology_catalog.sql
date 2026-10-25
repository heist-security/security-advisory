-- Catalog all product identities, independently of event recency or publisher.
-- Historical data is populated in resumable batches after this DDL commits.
set local lock_timeout='5s';
set local statement_timeout='30s';
create function public.technology_product_name(value text) returns text
language sql immutable parallel safe set search_path=public as $$
  select btrim(regexp_replace(btrim(value), '\s+(version\s+|v)?[0-9]+(\.[0-9]+){0,3}(\s+\(?(LTS|Current)\)?)?$', '', 'i'));
$$;
create function public.technology_catalog_search(id text,label text,aliases text[]) returns tsvector
language sql immutable parallel safe set search_path=public as $$
  select to_tsvector('simple',id || ' ' || label || ' ' || array_to_string(aliases,' '));
$$;
create table public.technology_catalog (
  id text primary key,
  label text not null,
  aliases text[] not null default '{}',
  search_document tsvector generated always as (
    public.technology_catalog_search(id,label,aliases)
  ) stored
);
create index technology_catalog_search on public.technology_catalog using gin(search_document);
create index technology_catalog_label on public.technology_catalog(label,id);
alter table public.technology_catalog enable row level security;
revoke all on public.technology_catalog from public,anon,authenticated;
grant all on public.technology_catalog to service_role;
alter table public.events add column technology_ids text[] not null default '{}';
create index events_technology_ids on public.events using gin(technology_ids);

-- Register every observed product, not a whitelist of supported technologies.
-- Semantic aliases still use reviewed rules: similarity alone is not identity.
create function public.register_event_technologies() returns trigger
language plpgsql set search_path=public as $$
declare product jsonb; name text; ecosystem text; package_index text; label_name text; key text; inherited text[]; keys text[]:='{}';
begin
  -- Existing publication serializes on this lock; backfill uses the same order.
  perform pg_advisory_xact_lock(719432001);
  select technology_ids into inherited from events
    where advisory_id=new.advisory_id and id<new.id order by id desc limit 1;
  for product in select * from jsonb_array_elements(coalesce(new.payload->'products','[]')) loop
    name:=btrim(product->'name'->>'value');
    if name is null or name='' then continue; end if;
    -- OSV package names are identifiers, not human release headings. Preserve
    -- numeric suffixes, scopes and namespace distinctions in those identities.
    label_name:=case when new.payload->'structured'->>'provider'='osv' then name else technology_product_name(name) end;
    key:=case when new.payload->'structured'->>'provider'='osv' then technology_key(label_name) else canonical_technology(label_name) end;
    if new.payload->'structured'->>'provider' is distinct from 'osv' then label_name:=case key when 'node-js' then 'Node.js' when 'python' then 'Python' when 'ruby' then 'Ruby' when 'php' then 'PHP' when 'go' then 'Go' when 'java' then 'Java' when 'openjdk' then 'OpenJDK' when 'oracle-java-se' then 'Oracle Java SE' when 'openssl' then 'OpenSSL' when 'postgresql' then 'PostgreSQL' when 'kubernetes' then 'Kubernetes' when 'nginx' then 'NGINX' when 'react' then 'React' when 'vue-js' then 'Vue.js' when 'rails' then 'Ruby on Rails' else label_name end; end if;
    if new.payload->'structured'->>'provider'='osv' then
      package_index:=substring(product->'name'->>'evidence' from '^/affected/([0-9]+)/package/name$');
      ecosystem:=coalesce(new.payload->'structured'->'affected'->(package_index::integer)->'package'->>'ecosystem','package');
      -- Exact package name + ecosystem, not a slug that could collide across
      -- namespaces (e.g. @scope/name vs scope-name) or package managers.
      key:='pkg-'||md5(ecosystem||chr(31)||name);
      label_name:=name||' ('||ecosystem||')';
    end if;
    if key='' then continue; end if;
    if length(key)>100 then key:='product-'||md5(label_name); end if;
    -- A stable canonical label is replaced only by a shorter name for the SAME
    -- identity; never by a release-specific variant or the latest event's case.
    insert into technology_catalog(id,label,aliases) values(key,label_name,array[name,technology_key(name)])
      on conflict(id) do update set
        label=case when length(excluded.label)<length(technology_catalog.label) then excluded.label else technology_catalog.label end,
        aliases=text_union(technology_catalog.aliases,excluded.aliases)
      where not technology_catalog.aliases @> excluded.aliases or length(excluded.label)<length(technology_catalog.label);
    keys:=text_union(keys,array[key]);
  end loop;
  new.technology_ids:=text_union(keys,coalesce(inherited,'{}'));
  return new;
end; $$;
create trigger register_event_technologies before insert or update of payload,technology_ids on public.events
  for each row execute function public.register_event_technologies();

create table public.technology_backfill (
  singleton boolean primary key default true check(singleton),
  last_id bigint not null default 0,
  completed_at timestamptz
);
insert into public.technology_backfill default values;
alter table public.technology_backfill enable row level security;
revoke all on public.technology_backfill from public,anon,authenticated;
grant all on public.technology_backfill to service_role;
create function public.backfill_event_technologies(p_limit integer default 100)
returns table(last_id bigint, processed integer, done boolean)
language plpgsql set search_path=public as $$
declare checkpoint technology_backfill; target events; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  perform pg_advisory_xact_lock(719432001);
  select * into checkpoint from technology_backfill where singleton for update;
  if checkpoint.completed_at is not null then return query select checkpoint.last_id,0,true; return; end if;
  for target in select * from events where id>checkpoint.last_id order by id limit p_limit loop
    -- Recalculate routing metadata only. No new event, extraction, or timestamp.
    update events set technology_ids=technology_ids where id=target.id;
    checkpoint.last_id:=target.id; count_rows:=count_rows+1;
  end loop;
  update technology_backfill set last_id=checkpoint.last_id,
    completed_at=case when count_rows<p_limit then clock_timestamp() else null end where singleton;
  return query select checkpoint.last_id,count_rows,count_rows<p_limit;
end; $$;
revoke all on function public.technology_catalog_search(text,text,text[]),public.technology_product_name(text),public.register_event_technologies(),public.backfill_event_technologies(integer) from public,anon,authenticated;
grant execute on function public.technology_catalog_search(text,text,text[]),public.technology_product_name(text),public.register_event_technologies(),public.backfill_event_technologies(integer) to service_role;
notify pgrst, 'reload schema';
