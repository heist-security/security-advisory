-- A derived grouped feed. Original events and their cursor namespace remain intact.
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(719432001);
alter table public.events add column group_id text;
create index events_group_history on public.events(group_id,id);

create table public.advisory_group_members (
  advisory_id uuid primary key references public.advisories(id),
  event_id bigint not null references public.events(id),
  anchor text,
  group_id text not null
);
create index advisory_group_members_anchor on public.advisory_group_members(anchor);
create index advisory_group_members_group on public.advisory_group_members(group_id);
create table public.advisory_groups (
  id text primary key,
  member_ids bigint[] not null,
  primary_event_id bigint not null references public.events(id),
  signatures jsonb not null,
  context jsonb not null,
  revision integer not null default 0,
  latest_update_id bigint,
  active boolean not null default true
);
create table public.advisory_group_updates (
  id bigint generated always as identity primary key,
  group_id text not null references public.advisory_groups(id),
  revision integer not null,
  member_ids bigint[] not null,
  primary_event_id bigint not null references public.events(id),
  changed_event_id bigint references public.events(id),
  change text not null check(change in ('published','updated','context','membership')),
  superseded_by text[] not null default '{}',
  published_at timestamptz not null,
  unique(group_id,revision)
);
create index advisory_group_updates_group on public.advisory_group_updates(group_id,id);

-- Expanded OSV aliases alone are insufficient: anchor a mirror to a single
-- explicit GHSA advisory reference, then compare native affected data below.
create function public.advisory_group_anchor(e public.events) returns text
language sql immutable set search_path=public as $$
  select case when e.source_id='core-osv' and e.payload#>>'{structured,provider}'='osv' then
    case when e.payload#>>'{structured,id}' ~ '^GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$'
      and e.payload#>>'{structured,provider_metadata,github_reviewed}'='true'
      then e.payload#>>'{structured,id}'
    else (select min(id) from (
      select distinct substring(ref from '(GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4})$') id
      from jsonb_array_elements_text(coalesce(e.payload#>'{structured,references}','[]')) ref
      where ref ~ '^https://github.com/([^/]+/[^/]+/security/)?advisories/GHSA-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}-[23456789cfghjmpqrvwx]{4}$'
    ) refs where e.payload#>'{structured,aliases}' ? id having count(*)=1) end
  end;
$$;

-- Exact ecosystem + package identity and native ranges/versions. At least one
-- common package must match, and NO common package may disagree. Additional
-- packages remain source-scoped. Unknown ranges cannot establish equivalence.
create function public.advisory_scopes_match(a jsonb,b jsonb) returns boolean
language sql immutable set search_path=public as $$
  with pairs as (
    select x,y from jsonb_array_elements(coalesce(a#>'{structured,affected}','[]')) x
    cross join jsonb_array_elements(coalesce(b#>'{structured,affected}','[]')) y
    where x#>>'{package,ecosystem}'=y#>>'{package,ecosystem}'
      and x#>>'{package,name}'=y#>>'{package,name}'
  )
  select exists(select 1 from pairs where
    (jsonb_array_length(coalesce(x->'versions','[]'))>0 or exists(
      select 1 from jsonb_array_elements(coalesce(x->'ranges','[]')) r,
        jsonb_array_elements(coalesce(r->'events','[]')) boundary
      where boundary ? 'fixed' or boundary ? 'last_affected' or boundary ? 'limit')))
    and not exists(select 1 from pairs where
      coalesce(x->'ranges','[]')<>coalesce(y->'ranges','[]') or
      coalesce(x->'versions','[]')<>coalesce(y->'versions','[]'));
$$;

create function public.refresh_advisory_group(key text,changed bigint,baseline boolean default false) returns void
language plpgsql set search_path=public as $$
declare previous advisory_groups; ids bigint[]; primary_id bigint; sig jsonb; context_state jsonb;
  changed_row events; should_emit boolean; reason text; update_id bigint; replacements text[];
begin
  select * into previous from advisory_groups where id=key;
  select * into changed_row from events where id=changed;
  select array_agg(e.id order by e.advisory_id),
    jsonb_object_agg(e.advisory_id::text,
      ((case when e.source_id='core-osv' then e.payload-'related_cves' else e.payload end)
        #- '{structured,modified}' #- '{structured,aliases}' #- '{structured,references}')),
    jsonb_build_object('severity',coalesce((array_agg(e.priority->>'severity' order by severity_rank(e.priority->>'severity') desc))[1],'unknown'),
      'known_exploited',bool_or(coalesce((e.priority->>'known_exploited')::boolean,false)),
      'fix_available',bool_or(coalesce((e.priority->>'fix_available')::boolean,false)))
    into ids,sig,context_state
    from advisory_group_members m join events e on e.id=m.event_id where m.group_id=key;
  if ids is null then
    if previous.id is null or not previous.active then return; end if;
    select coalesce(array_agg(distinct m.group_id),'{}') into replacements
      from events e join advisory_group_members m using(advisory_id) where e.id=any(previous.member_ids);
    update advisory_groups set active=false,revision=revision+1 where id=key;
    insert into advisory_group_updates(group_id,revision,member_ids,primary_event_id,changed_event_id,change,superseded_by,published_at)
      values(key,previous.revision+1,previous.member_ids,previous.primary_event_id,changed,'membership',replacements,changed_row.published_at)
      returning id into update_id;
    update advisory_groups set latest_update_id=update_id where id=key;
    return;
  end if;
  select e.id into primary_id from events e where e.id=any(ids)
    order by (e.payload->>'kind'='withdrawal'),
      (e.payload#>>'{structured,provider_metadata,github_reviewed}'='true') desc nulls last,
      e.source_published_at nulls last,e.advisory_id limit 1;
  -- A newly discovered mirror changes attribution, not the announcement.
  -- Existing source changes, withdrawals, reversions and effective risk changes
  -- create notifications. Context provenance alone does not notify repeatedly.
  should_emit:=previous.id is null or not previous.active or
    exists(select 1 from jsonb_each(sig) s where previous.signatures ? s.key and previous.signatures->s.key<>s.value) or
    exists(select 1 from jsonb_object_keys(previous.signatures) k where not sig ? k) or
    (previous.context is distinct from context_state and not baseline);
  reason:=case when previous.id is null then 'published'
    when changed_row.context_update then 'context' else 'updated' end;
  insert into advisory_groups(id,member_ids,primary_event_id,signatures,context)
    values(key,ids,primary_id,sig,context_state)
    on conflict(id) do update set member_ids=excluded.member_ids,primary_event_id=excluded.primary_event_id,
      signatures=excluded.signatures,context=excluded.context,active=true;
  if should_emit then
    update advisory_groups set revision=revision+1 where id=key;
    insert into advisory_group_updates(group_id,revision,member_ids,primary_event_id,changed_event_id,change,published_at)
      select key,revision,ids,primary_id,changed,reason,changed_row.published_at from advisory_groups where id=key
      returning id into update_id;
    update advisory_groups set latest_update_id=update_id where id=key;
  elsif baseline then
    -- During the initial build, finish the single baseline snapshot with every
    -- source. Its date is historical; backfill never replays source revisions.
    update advisory_group_updates set member_ids=ids,primary_event_id=primary_id,
      published_at=greatest(published_at,changed_row.published_at)
      where id=(select latest_update_id from advisory_groups where id=key);
  end if;
end; $$;

create function public.sync_advisory_group(event_id bigint,baseline boolean default false) returns void
language plpgsql set search_path=public as $$
declare incoming events; old_anchor text; anchor_id text; candidate record; anchor_row events;
  old_key text; new_key text; affected text[]:='{}'; key text;
begin
  perform pg_advisory_xact_lock(719432001);
  select * into incoming from events where id=event_id;
  -- Deferred triggers see the final context revision from the transaction.
  if exists(select 1 from events where advisory_id=incoming.advisory_id and id>event_id) then return; end if;
  select anchor,group_id into old_anchor,old_key from advisory_group_members where advisory_id=incoming.advisory_id;
  anchor_id:=advisory_group_anchor(incoming);
  -- A withdrawal keeps the established attribution and is visible as a change
  -- to that source, rather than asserting every other source withdrew too.
  if incoming.payload->>'kind'='withdrawal' then anchor_id:=coalesce(old_anchor,anchor_id); end if;
  insert into advisory_group_members(advisory_id,event_id,anchor,group_id)
    values(incoming.advisory_id,incoming.id,anchor_id,coalesce(old_key,'advisory:'||incoming.advisory_id))
    on conflict(advisory_id) do update set event_id=excluded.event_id,anchor=excluded.anchor;
  -- Read every member's final revision together. One publisher change can emit
  -- several linked-context events in the same transaction; they must not
  -- produce intermediate group notifications with stale peer ratings.
  update advisory_group_members m set event_id=(select max(e.id) from events e where e.advisory_id=m.advisory_id)
    where m.anchor=anchor_id or m.anchor=old_anchor;
  for candidate in select m.*,e.payload from advisory_group_members m join events e on e.id=m.event_id
    where m.advisory_id=incoming.advisory_id or m.anchor=anchor_id or m.anchor=old_anchor
    order by m.advisory_id
  loop
    select * into anchor_row from events e where e.source_id='core-osv' and e.payload#>>'{structured,id}'=candidate.anchor
      order by e.id desc limit 1;
    new_key:='advisory:'||candidate.advisory_id;
    if candidate.payload->>'kind'='withdrawal' and candidate.group_id like 'osv:%' then
      new_key:=candidate.group_id;
    elsif anchor_row.payload->>'kind'='withdrawal' and candidate.group_id='osv:'||candidate.anchor then
      new_key:=candidate.group_id;
    elsif anchor_row.id is not null and anchor_row.payload#>>'{structured,provider_metadata,github_reviewed}'='true'
      and anchor_row.payload->>'kind'<>'withdrawal'
      and (candidate.advisory_id=anchor_row.advisory_id or (
        advisory_scopes_match(candidate.payload,anchor_row.payload)
        and not exists(select 1 from advisory_group_members peer join events e on e.id=peer.event_id
          where peer.anchor=candidate.anchor and peer.advisory_id<>candidate.advisory_id
            and e.payload->>'kind'<>'withdrawal' and advisory_scopes_match(e.payload,anchor_row.payload)
            and not advisory_scopes_match(candidate.payload,e.payload)))) then
      new_key:='osv:'||candidate.anchor;
    end if;
    affected:=text_union(affected,array[candidate.group_id,new_key]);
    update advisory_group_members set group_id=new_key where advisory_id=candidate.advisory_id;
    update events set group_id=new_key where advisory_id=candidate.advisory_id and group_id is distinct from new_key;
  end loop;
  foreach key in array affected loop perform refresh_advisory_group(key,event_id,baseline); end loop;
end; $$;

create function public.publish_advisory_group() returns trigger
language plpgsql set search_path=public as $$
begin perform sync_advisory_group(new.id); return null; end; $$;
create constraint trigger publish_advisory_group after insert on public.events
  deferrable initially deferred for each row execute function public.publish_advisory_group();

create table public.advisory_group_backfill (
  singleton boolean primary key default true check(singleton),
  last_id bigint not null default 0,
  completed_at timestamptz
);
insert into public.advisory_group_backfill default values;
create function public.backfill_advisory_groups(p_limit integer default 100)
returns table(last_id bigint,processed integer,done boolean)
language plpgsql set search_path=public as $$
declare checkpoint advisory_group_backfill; target events; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  perform pg_advisory_xact_lock(719432001);
  select * into checkpoint from advisory_group_backfill where singleton for update;
  if checkpoint.completed_at is not null then return query select checkpoint.last_id,0,true; return; end if;
  for target in select e.* from events e where e.id>checkpoint.last_id
    and not exists(select 1 from events later where later.advisory_id=e.advisory_id and later.id>e.id)
    order by e.id limit p_limit loop
    if not exists(select 1 from advisory_group_members where advisory_id=target.advisory_id) then
      perform sync_advisory_group(target.id,true);
    end if;
    checkpoint.last_id:=target.id; count_rows:=count_rows+1;
  end loop;
  update advisory_group_backfill set last_id=checkpoint.last_id,
    completed_at=case when count_rows<p_limit then clock_timestamp() else null end where singleton;
  return query select checkpoint.last_id,count_rows,count_rows<p_limit;
end; $$;

-- Only public event fields are returned; model/queue metadata stays private.
create function public.public_group_event(e public.events) returns jsonb
language sql immutable set search_path=public as $$
  select jsonb_build_object('id',e.id,'advisory_id',e.advisory_id,'group_id',e.group_id,'revision',e.revision,
    'source_id',e.source_id,'source_url',e.source_url,'source_published_at',e.source_published_at,
    'published_at',e.published_at,'extraction_method',e.extraction_method,'technologies',e.technologies,
    'cve_ids',e.cve_ids,'event_types',e.event_types,'payload',e.payload,'priority',e.priority,'context_update',e.context_update);
$$;
create function public.group_event_matches(e public.events,filters jsonb) returns boolean
language sql stable set search_path=public as $$
  select (not filters ? 'type' or e.event_types @> array[filters->>'type'])
    and (not filters ? 'source' or e.source_id=filters->>'source')
    and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
    and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
    and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
    and (not filters ? 'important' or e.important)
    and (not filters ? 'fix' or e.fix_available)
    and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'));
$$;
create function public.query_advisory_groups(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null,updates boolean default false)
returns setof jsonb language plpgsql stable set search_path=public as $$
begin
  if p_limit<1 or p_limit>101 or (p_after is not null and p_before is not null) then raise exception 'Invalid pagination'; end if;
  return query
  with candidates as (
    select u.*,case when updates then u.member_ids else g.member_ids end as current_ids,
      case when updates then u.primary_event_id else g.primary_event_id end as current_primary
    from advisory_group_updates u join advisory_groups g on g.id=u.group_id
    where (updates or (g.active and u.id=g.latest_update_id))
      and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
      and (not filters ? 'group' or u.group_id=filters->>'group')
      and exists(select 1 from events e where e.id=any(case when updates then u.member_ids else g.member_ids end)
        and group_event_matches(e,filters))
    order by case when p_after is not null then u.id end asc,u.id desc limit p_limit
  )
  select jsonb_build_object('id',c.id,'group_id',c.group_id,'revision',c.revision,'published_at',c.published_at,
    'change',c.change,'superseded_by',c.superseded_by,
    'primary',public_group_event(p),'changed',public_group_event(ch),
    'members',(select jsonb_agg(public_group_event(e) order by e.id) from events e where e.id=any(c.current_ids)))
  from candidates c join events p on p.id=c.current_primary left join events ch on ch.id=c.changed_event_id
  order by case when p_after is not null then c.id end asc,c.id desc;
end; $$;

alter table public.advisory_group_members enable row level security;
alter table public.advisory_groups enable row level security;
alter table public.advisory_group_updates enable row level security;
alter table public.advisory_group_backfill enable row level security;
revoke all on public.advisory_group_members,public.advisory_groups,public.advisory_group_updates,public.advisory_group_backfill from public,anon,authenticated;
grant all on public.advisory_group_members,public.advisory_groups,public.advisory_group_updates,public.advisory_group_backfill to service_role;
grant usage,select on sequence public.advisory_group_updates_id_seq to service_role;
revoke all on function public.advisory_group_anchor(public.events),public.advisory_scopes_match(jsonb,jsonb),
  public.refresh_advisory_group(text,bigint,boolean),public.sync_advisory_group(bigint,boolean),public.publish_advisory_group(),
  public.backfill_advisory_groups(integer),public.public_group_event(public.events),public.group_event_matches(public.events,jsonb),
  public.query_advisory_groups(jsonb,integer,bigint,bigint,boolean) from public,anon,authenticated;
grant execute on function public.advisory_group_anchor(public.events),public.advisory_scopes_match(jsonb,jsonb),
  public.refresh_advisory_group(text,bigint,boolean),public.sync_advisory_group(bigint,boolean),public.publish_advisory_group(),
  public.backfill_advisory_groups(integer),public.public_group_event(public.events),public.group_event_matches(public.events,jsonb),
  public.query_advisory_groups(jsonb,integer,bigint,bigint,boolean) to service_role;
notify pgrst,'reload schema';
