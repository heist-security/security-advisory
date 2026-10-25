-- Persist evidence-backed priority before pagination; no public database grants.
-- Context changes append revisions, preserving the commit-ordered event cursor.
select pg_advisory_xact_lock(719432001);
alter table public.events alter column document_id drop not null;
alter table public.events add column priority jsonb not null default '{}',
  add column severity_keys text[] not null default '{}',
  add column important boolean not null default false,
  add column fix_available boolean not null default false,
  add column context_update boolean not null default false;
create index events_severities on public.events using gin(severity_keys);
create index events_important on public.events(id) where important;
create index events_fixes on public.events(id) where fix_available;
create index events_structured_identity on public.events(source_id,(payload#>>'{structured,id}'),id desc);
create index events_latest_advisory on public.events(advisory_id,id desc);

create function public.severity_rank(s text) returns integer
language sql immutable set search_path=public as $$
  select case s when 'critical' then 4 when 'high' then 3 when 'medium' then 2 when 'low' then 1 else 0 end;
$$;

-- Use current payload identities, never correction-routing keys, as relationship evidence.
create function public.event_cve_links(e public.events) returns jsonb
language plpgsql stable set search_path=public as $$
declare links jsonb:='[]'; c jsonb; body text; heading text;
begin
  if e.payload->>'kind'='withdrawal' then return links; end if;
  if e.source_id in ('core-cve','core-osv','core-kev') and e.payload ? 'structured' then
    select coalesce(jsonb_agg(jsonb_build_object('cve',v->>'value','relationship','advisory','evidence',v->>'evidence')),'[]')
      into links from jsonb_array_elements(coalesce(e.payload->'related_cves','[]')) v;
    return links;
  end if;
  -- New extractions carry an explicit fix relationship checked against source text.
  select coalesce(jsonb_agg(v || jsonb_build_object('relationship','fixes')),'[]') into links
    from jsonb_array_elements(coalesce(e.payload->'fixed_cves','[]')) v
    where exists(select 1 from jsonb_array_elements(coalesce(e.payload->'related_cves','[]')) rel where rel->>'value'=v->>'cve');
  if e.payload ? 'fixed_cves' then return links; end if;
  -- Conservative compatibility for old extractions: only a verbatim opening heading
  -- explicitly describing CVE fixes, plus documented fixed versions. Never use a
  -- model summary or a related headline found later in the document.
  if e.payload->>'kind'<>'patch' or not exists(select 1 from jsonb_array_elements(coalesce(e.payload->'products','[]')) p
      where jsonb_array_length(coalesce(p->'fixed_versions','[]'))>0) then return links; end if;
  select regexp_replace(translate(d.body,'’',''''),'\s+',' ','g') into body from documents d where d.id=coalesce(e.document_id,(select latest_document_id from advisories where id=e.advisory_id));
  heading:=regexp_replace(translate(e.payload->>'title','’',''''),'\s+',' ','g');
  if length(heading)>0 and position(heading in body) between 1 and 80
    and heading ~* '\m(fixes|fixed|patches|patched|addresses|addressed|resolves|resolved)\M'
    and heading !~* '\m(not|no|unfixed|unpatched|unrelated|will|planned)\M' then
    for c in select * from jsonb_array_elements(coalesce(e.payload->'related_cves','[]')) loop
      if heading ~ ('\m'||(c->>'value')||'\M') then
        links:=links||jsonb_build_array(jsonb_build_object('cve',c->>'value','relationship','fixes','evidence',heading,'basis','publisher_heading'));
      end if;
    end loop;
  end if;
  return links;
end; $$;

create function public.event_priority(e public.events) returns jsonb
language plpgsql stable set search_path=public as $$
declare own text:=coalesce(e.payload->>'severity','unknown'); effective text; links jsonb; ratings jsonb:='[]';
  link jsonb; rating record; exploited boolean:=false; fixes boolean; reasons text[]:='{}'; rejected boolean;
begin
  if e.payload->>'kind'='withdrawal' then own:='unknown'; end if;
  if severity_rank(own)=0 then own:='unknown'; end if;
  effective:=own;
  exploited:=e.payload->>'kind'<>'withdrawal' and coalesce(e.payload#>>'{structured,exploitation,known_exploited}'='true',false);
  fixes:=e.payload->>'kind'<>'withdrawal' and exists(select 1 from jsonb_array_elements(coalesce(e.payload->'products','[]')) p
    where jsonb_array_length(coalesce(p->'fixed_versions','[]'))>0);
  links:=event_cve_links(e);
  for link in select * from jsonb_array_elements(links) loop
    -- A rejected current CVE record cannot borrow an old OSV rating.
    select coalesce((select x.payload->>'kind'='withdrawal' from events x
      where x.source_id='core-cve' and x.payload#>>'{structured,id}'=link->>'cve'
      order by x.id desc limit 1),false) into rejected;
    for rating in
      select x.* from (
        select distinct on (v.advisory_id) v.* from events v
        where v.advisory_id<>e.advisory_id and v.source_id in ('core-cve','core-osv','core-kev') and v.cve_ids @> array[link->>'cve']
        order by v.advisory_id,v.id desc
      ) x where x.payload->>'kind'<>'withdrawal'
        and exists(select 1 from jsonb_array_elements(coalesce(x.payload->'related_cves','[]')) c where c->>'value'=link->>'cve')
        and (x.source_id='core-kev' or not rejected)
      order by x.source_id,x.source_url
    loop
      if severity_rank(rating.payload->>'severity')>severity_rank(effective) then effective:=rating.payload->>'severity'; end if;
      if rating.payload#>>'{structured,exploitation,known_exploited}'='true' then exploited:=true; end if;
      if severity_rank(rating.payload->>'severity')>0 or rating.payload#>>'{structured,exploitation,known_exploited}'='true' then
        ratings:=ratings||jsonb_build_array(jsonb_build_object(
          'cve',link->>'cve','relationship',link->>'relationship','relationship_evidence',link->>'evidence',
          'source_id',rating.source_id,'source_url',rating.source_url,
          'severity',coalesce(rating.payload->>'severity','unknown'),
          'products',coalesce(rating.payload->'products','[]'),
          'metrics',coalesce(rating.payload#>'{structured,metrics}','[]'),
          'known_exploited',coalesce(rating.payload#>>'{structured,exploitation,known_exploited}'='true',false)));
      end if;
    end loop;
  end loop;
  if severity_rank(own)>=3 then reasons:=array_append(reasons,'publisher_severity'); end if;
  if exists(select 1 from jsonb_array_elements(ratings) r where severity_rank(r->>'severity')>=3) then reasons:=array_append(reasons,'linked_severity'); end if;
  if exploited then reasons:=array_append(reasons,'known_exploited'); end if;
  if fixes and effective='unknown' then reasons:=array_append(reasons,'unrated_security_fix'); end if;
  return jsonb_build_object('severity',effective,'publisher_severity',own,'linked_cves',ratings,
    'fix_available',coalesce(fixes,false),'known_exploited',exploited,'reasons',to_jsonb(reasons));
end; $$;

-- Initial snapshot only: no paid re-extraction and no historical notification flood.
update public.events e set priority=event_priority(e);
update public.events e set severity_keys=array[e.priority->>'severity'],
  important=jsonb_array_length(e.priority->'reasons')>0,fix_available=(e.priority->>'fix_available')::boolean;
-- Preserve correction delivery in subscriptions, just like type/CVE routing keys.
update public.events e set
  severity_keys=(select array_agg(distinct s) from events h cross join lateral unnest(h.severity_keys) s where h.advisory_id=e.advisory_id and h.id<=e.id),
  important=exists(select 1 from events h where h.advisory_id=e.advisory_id and h.id<=e.id and h.important),
  fix_available=exists(select 1 from events h where h.advisory_id=e.advisory_id and h.id<=e.id and h.fix_available);

create function public.prepare_event_priority() returns trigger
language plpgsql set search_path=public as $$
declare previous events;
begin
  -- Same lock as finish_document: appending context revisions must not overtake publication.
  perform pg_advisory_xact_lock(719432001);
  select * into previous from events where advisory_id=new.advisory_id order by id desc limit 1;
  new.priority:=event_priority(new);
  new.severity_keys:=text_union(coalesce(previous.severity_keys,'{}'),array[new.priority->>'severity']);
  new.important:=coalesce(previous.important,false) or jsonb_array_length(new.priority->'reasons')>0;
  new.fix_available:=coalesce(previous.fix_available,false) or (new.priority->>'fix_available')::boolean;
  return new;
end; $$;
create trigger prepare_event_priority before insert on public.events for each row execute function public.prepare_event_priority();

create function public.refresh_linked_priority() returns trigger
language plpgsql set search_path=public as $$
declare target events; calculated jsonb; next_revision integer;
begin
  if new.context_update or new.source_id not in ('core-cve','core-osv','core-kev') then return null; end if;
  -- Include removals via retained CVE routing keys, but use only current payload links.
  for target in
    select e.* from events e where e.cve_ids && new.cve_ids and e.advisory_id<>new.advisory_id
      and e.payload->>'kind'<>'withdrawal'
      and not exists(select 1 from events later where later.advisory_id=e.advisory_id and later.id>e.id)
    order by e.id
  loop
    calculated:=event_priority(target);
    if calculated is distinct from target.priority then
      update advisories set revision=revision+1 where id=target.advisory_id returning revision into next_revision;
      -- document_id remains unique for actual source extractions. Context-only revisions
      -- have no new document; the source's latest_document_id is intentionally unchanged.
      insert into events(advisory_id,revision,document_id,source_id,source_url,source_published_at,
        extraction_method,model,extractor_version,payload,technologies,cve_ids,event_types,context_update)
      values(target.advisory_id,next_revision,null,target.source_id,target.source_url,target.source_published_at,
        target.extraction_method,target.model,target.extractor_version,target.payload,
        target.technologies,target.cve_ids,target.event_types,true);
    end if;
  end loop;
  return null;
end; $$;
create trigger refresh_linked_priority after insert on public.events for each row execute function public.refresh_linked_priority();
revoke all on function public.severity_rank(text),public.event_cve_links(public.events),public.event_priority(public.events),
  public.prepare_event_priority(),public.refresh_linked_priority() from public,anon,authenticated;
grant execute on function public.severity_rank(text),public.event_cve_links(public.events),public.event_priority(public.events),
  public.prepare_event_priority(),public.refresh_linked_priority() to service_role;
