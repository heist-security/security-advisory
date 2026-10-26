-- Relational read models for current browsing and immutable update delivery.
-- DDL stays small; the release runner populates existing data in committed batches.
set local lock_timeout='5s';
set local statement_timeout='30s';

create table public.advisory_feed_members (
  feed_id bigint not null references public.advisory_group_updates(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  group_id text not null references public.advisory_groups(id) on delete cascade,
  source_id text not null,
  event_types text[] not null,
  severity_keys text[] not null,
  cve_ids text[] not null,
  technology_ids text[] not null,
  technologies text[] not null,
  important boolean not null,
  fix_available boolean not null,
  search_document tsvector not null,
  primary key(feed_id,event_id)
);
create index advisory_feed_members_group on public.advisory_feed_members(group_id,feed_id);
create index advisory_feed_members_event on public.advisory_feed_members(event_id);
create index advisory_feed_members_source on public.advisory_feed_members(source_id,feed_id);
create index advisory_feed_members_important on public.advisory_feed_members(feed_id) where important;
create index advisory_feed_members_fix on public.advisory_feed_members(feed_id) where fix_available;
-- Maintain searchable entries on publication so reads do not depend on
-- background cleanup of a GIN pending list.
create index advisory_feed_members_filters on public.advisory_feed_members using gin
  (event_types,severity_keys,cve_ids,technology_ids,technologies,search_document) with (fastupdate=off);

create table public.advisory_update_members (
  feed_id bigint not null references public.advisory_group_updates(id) on delete cascade,
  event_id bigint not null references public.events(id) on delete cascade,
  group_id text not null references public.advisory_groups(id) on delete cascade,
  source_id text not null,
  event_types text[] not null,
  severity_keys text[] not null,
  cve_ids text[] not null,
  technology_ids text[] not null,
  technologies text[] not null,
  important boolean not null,
  fix_available boolean not null,
  search_document tsvector not null,
  primary key(feed_id,event_id)
);
create index advisory_update_members_group on public.advisory_update_members(group_id,feed_id);
create index advisory_update_members_event on public.advisory_update_members(event_id);
create index advisory_update_members_source on public.advisory_update_members(source_id,feed_id);
create index advisory_update_members_important on public.advisory_update_members(feed_id) where important;
create index advisory_update_members_fix on public.advisory_update_members(feed_id) where fix_available;
create index advisory_update_members_filters on public.advisory_update_members using gin
  (event_types,severity_keys,cve_ids,technology_ids,technologies,search_document) with (fastupdate=off);

-- These projections share a transaction with publication. Membership stays
-- source-scoped, so AND filters can never combine claims from different sources.
-- Existing snapshot arrays remain a compatibility/backfill input only; reads
-- and payload hydration use the relational memberships below.
create function public.refresh_advisory_feed_members(target text) returns void
language sql set search_path=public as $$
  delete from advisory_feed_members where group_id=target;
  insert into advisory_feed_members(feed_id,event_id,group_id,source_id,event_types,severity_keys,cve_ids,technology_ids,technologies,important,fix_available,search_document)
  select g.latest_update_id,e.id,g.id,e.source_id,e.event_types,e.severity_keys,e.cve_ids,e.technology_ids,e.technologies,e.important,e.fix_available,e.search_document
  from advisory_groups g cross join lateral unnest(g.member_ids) m(event_id)
    join events e on e.id=m.event_id
  where g.active and g.latest_update_id is not null and g.id=target;
$$;
create function public.sync_advisory_feed_members() returns trigger
language plpgsql set search_path=public as $$
begin perform refresh_advisory_feed_members(new.id); return null; end; $$;
create trigger sync_advisory_feed_members after insert or update of member_ids,latest_update_id,active
  on public.advisory_groups for each row execute function public.sync_advisory_feed_members();

create function public.refresh_advisory_update_members(target bigint) returns void
language sql set search_path=public as $$
  delete from advisory_update_members where feed_id=target;
  insert into advisory_update_members(feed_id,event_id,group_id,source_id,event_types,severity_keys,cve_ids,technology_ids,technologies,important,fix_available,search_document)
  select g.id,e.id,g.group_id,e.source_id,e.event_types,e.severity_keys,e.cve_ids,e.technology_ids,e.technologies,e.important,e.fix_available,e.search_document
  from advisory_group_updates g cross join lateral unnest(g.member_ids) m(event_id)
    join events e on e.id=m.event_id
  where g.id=target;
$$;
create function public.sync_advisory_update_members() returns trigger
language plpgsql set search_path=public as $$
begin perform refresh_advisory_update_members(new.id); return null; end; $$;
create trigger sync_advisory_update_members after insert or update of member_ids
  on public.advisory_group_updates for each row execute function public.sync_advisory_update_members();

-- Metadata backfills/corrections can update routing on an existing event.
-- Group reassignment alone does not rewrite these filter records.
create function public.sync_advisory_member_filters() returns trigger
language plpgsql set search_path=public as $$
begin
  update advisory_feed_members set
    source_id=new.source_id,
    event_types=new.event_types,
    severity_keys=new.severity_keys,
    cve_ids=new.cve_ids,
    technology_ids=new.technology_ids,
    technologies=new.technologies,
    important=new.important,
    fix_available=new.fix_available,
    search_document=new.search_document
  where event_id=new.id;
  update advisory_update_members set
    source_id=new.source_id,
    event_types=new.event_types,
    severity_keys=new.severity_keys,
    cve_ids=new.cve_ids,
    technology_ids=new.technology_ids,
    technologies=new.technologies,
    important=new.important,
    fix_available=new.fix_available,
    search_document=new.search_document
  where event_id=new.id;
  return null;
end; $$;
create trigger sync_advisory_member_filters after update on public.events
  for each row when (row(old.source_id,old.event_types,old.severity_keys,old.cve_ids,old.technology_ids,old.technologies,old.important,old.fix_available,old.search_document)
    is distinct from row(new.source_id,new.event_types,new.severity_keys,new.cve_ids,new.technology_ids,new.technologies,new.important,new.fix_available,new.search_document))
  execute function public.sync_advisory_member_filters();

create table public.advisory_feed_backfill (
  singleton boolean primary key default true check(singleton),
  current_id bigint not null default 0,
  update_id bigint not null default 0,
  current_done boolean not null default false,
  completed_at timestamptz
);
insert into public.advisory_feed_backfill(completed_at)
  select case when not exists(select 1 from advisory_groups)
    and not exists(select 1 from advisory_group_updates) then now() end;

create function public.backfill_advisory_feed(p_limit integer default 100)
returns table(last_id bigint,processed integer,done boolean)
language plpgsql set search_path=public as $$
declare checkpoint advisory_feed_backfill; item record; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  select * into checkpoint from advisory_feed_backfill where singleton;
  if checkpoint.completed_at is not null then return query select checkpoint.update_id,0,true; return; end if;
  perform pg_advisory_xact_lock(719432001);
  select * into checkpoint from advisory_feed_backfill where singleton for update;
  if checkpoint.completed_at is not null then return query select checkpoint.update_id,0,true; return; end if;
  if not checkpoint.current_done then
    for item in select id,latest_update_id from advisory_groups
      where active and latest_update_id>checkpoint.current_id order by latest_update_id limit p_limit loop
      perform refresh_advisory_feed_members(item.id);
      checkpoint.current_id:=item.latest_update_id; count_rows:=count_rows+1;
    end loop;
    update advisory_feed_backfill set current_id=checkpoint.current_id,current_done=count_rows<p_limit where singleton;
    return query select checkpoint.current_id,count_rows,false;
  else
    for item in select id from advisory_group_updates where id>checkpoint.update_id order by id limit p_limit loop
      perform refresh_advisory_update_members(item.id);
      checkpoint.update_id:=item.id; count_rows:=count_rows+1;
    end loop;
    update advisory_feed_backfill set update_id=checkpoint.update_id,
      completed_at=case when count_rows<p_limit then clock_timestamp() end where singleton;
    if count_rows<p_limit then
      analyze advisory_feed_members;
      analyze advisory_update_members;
    end if;
    return query select checkpoint.update_id,count_rows,count_rows<p_limit;
  end if;
end; $$;

-- Build only the requested predicates. All values remain bound parameters;
-- table names/operators are fixed SQL, never supplied by the caller.
create function public.advisory_feed_where(filters jsonb,p_limit integer,p_after bigint,p_before bigint) returns text
language plpgsql immutable set search_path=public as $$
declare predicates text:='true';
begin
  if p_limit is null or p_limit<1 or p_limit>101 or (p_after is not null and p_before is not null) then raise exception 'Invalid pagination'; end if;
  if filters ? 'group' then predicates:=predicates||$clause$ and m.group_id=$1->>'group'$clause$; end if;
  if filters ? 'type' then predicates:=predicates||$clause$ and m.event_types && string_to_array($1->>'type',',')$clause$; end if;
  if filters ? 'source' then predicates:=predicates||$clause$ and m.source_id=$1->>'source'$clause$; end if;
  if filters ? 'cve' then predicates:=predicates||$clause$ and m.cve_ids @> array[$1->>'cve']$clause$; end if;
  if filters ? 'technology' then predicates:=predicates||$clause$ and (m.technology_ids && string_to_array($1->>'technology',',') or m.technologies && string_to_array($1->>'technology',','))$clause$; end if;
  if filters ? 'severity' then predicates:=predicates||$clause$ and m.severity_keys && $5$clause$; end if;
  if filters ? 'important' then predicates:=predicates||$clause$ and m.important$clause$; end if;
  if filters ? 'fix' then predicates:=predicates||$clause$ and m.fix_available$clause$; end if;
  if filters ? 'q' then predicates:=predicates||$clause$ and m.search_document @@ plainto_tsquery('simple',$1->>'q')$clause$; end if;
  if p_after is not null then predicates:=predicates||' and m.feed_id>$3'; end if;
  if p_before is not null then predicates:=predicates||' and m.feed_id<$4'; end if;
  return predicates;
end; $$;

create function public.query_advisory_current(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null)
returns setof jsonb language plpgsql stable set search_path=public as $$
declare predicates text:=advisory_feed_where(filters,p_limit,p_after,p_before);
  direction text:=case when p_after is null then 'desc' else 'asc' end;
  severities text[]:=array(select jsonb_array_elements_text(filters->'severity'));
begin
  return query execute format($query$
    with page as materialized (
      select distinct m.feed_id from advisory_feed_members m where %s
      order by m.feed_id %s limit $2
    )
    select jsonb_build_object('id',u.id,'group_id',u.group_id,'revision',u.revision,'published_at',u.published_at,
      'change',u.change,'superseded_by',u.superseded_by,
      'primary',public_group_event(p),'changed',public_group_event(ch),
      'members',(select jsonb_agg(public_group_event(e) order by e.id)
        from advisory_feed_members m join events e on e.id=m.event_id where m.feed_id=page.feed_id))
    from page join advisory_group_updates u on u.id=page.feed_id
    join advisory_groups g on g.latest_update_id=page.feed_id and g.active
      join events p on p.id=g.primary_event_id left join events ch on ch.id=u.changed_event_id
    order by page.feed_id %s
  $query$,predicates,direction,direction) using filters,p_limit,p_after,p_before,severities;
end; $$;

create function public.query_advisory_updates(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null)
returns setof jsonb language plpgsql stable set search_path=public as $$
declare predicates text:=advisory_feed_where(filters,p_limit,p_after,p_before);
  direction text:=case when p_after is null then 'desc' else 'asc' end;
  severities text[]:=array(select jsonb_array_elements_text(filters->'severity'));
begin
  return query execute format($query$
    with page as materialized (
      select distinct m.feed_id from advisory_update_members m where %s
      order by m.feed_id %s limit $2
    )
    select jsonb_build_object('id',u.id,'group_id',u.group_id,'revision',u.revision,'published_at',u.published_at,
      'change',u.change,'superseded_by',u.superseded_by,
      'primary',public_group_event(p),'changed',public_group_event(ch),
      'members',(select jsonb_agg(public_group_event(e) order by e.id)
        from advisory_update_members m join events e on e.id=m.event_id where m.feed_id=page.feed_id))
    from page join advisory_group_updates u on u.id=page.feed_id
      join events p on p.id=u.primary_event_id left join events ch on ch.id=u.changed_event_id
    order by page.feed_id %s
  $query$,predicates,direction,direction) using filters,p_limit,p_after,p_before,severities;
end; $$;

-- Old application instances keep working while the resumable copy runs.
-- New application code calls the two explicit RPCs after release completes it.
alter function public.query_advisory_groups(jsonb,integer,bigint,bigint,boolean) rename to query_advisory_groups_legacy;
create function public.query_advisory_groups(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null,updates boolean default false)
returns setof jsonb language plpgsql stable set search_path=public as $$
begin
  if exists(select 1 from advisory_feed_backfill where completed_at is null) then
    return query select * from query_advisory_groups_legacy(filters,p_limit,p_after,p_before,updates);
  elsif updates then
    return query select * from query_advisory_updates(filters,p_limit,p_after,p_before);
  else
    return query select * from query_advisory_current(filters,p_limit,p_after,p_before);
  end if;
end; $$;

alter table public.advisory_feed_members enable row level security;
revoke all on public.advisory_feed_members from public,anon,authenticated;
grant all on public.advisory_feed_members to service_role;
alter table public.advisory_update_members enable row level security;
revoke all on public.advisory_update_members from public,anon,authenticated;
grant all on public.advisory_update_members to service_role;
alter table public.advisory_feed_backfill enable row level security;
revoke all on public.advisory_feed_backfill from public,anon,authenticated;
grant all on public.advisory_feed_backfill to service_role;
revoke all on function
  public.refresh_advisory_feed_members(text),
  public.refresh_advisory_update_members(bigint),
  public.sync_advisory_feed_members(),
  public.sync_advisory_update_members(),
  public.sync_advisory_member_filters(),
  public.backfill_advisory_feed(integer),
  public.advisory_feed_where(jsonb,integer,bigint,bigint),
  public.query_advisory_current(jsonb,integer,bigint,bigint),
  public.query_advisory_updates(jsonb,integer,bigint,bigint),
  public.query_advisory_groups(jsonb,integer,bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function
  public.refresh_advisory_feed_members(text),
  public.refresh_advisory_update_members(bigint),
  public.sync_advisory_feed_members(),
  public.sync_advisory_update_members(),
  public.sync_advisory_member_filters(),
  public.backfill_advisory_feed(integer),
  public.advisory_feed_where(jsonb,integer,bigint,bigint),
  public.query_advisory_current(jsonb,integer,bigint,bigint),
  public.query_advisory_updates(jsonb,integer,bigint,bigint),
  public.query_advisory_groups(jsonb,integer,bigint,bigint,boolean) to service_role;
notify pgrst,'reload schema';
