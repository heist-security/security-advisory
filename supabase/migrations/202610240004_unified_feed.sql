-- Durable feed enumeration, correction-safe publication and subscription indexes.
-- Apply after 003. Historical migrations remain unchanged.
create table public.feed_entries (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources(id),
  source_url text not null,
  fingerprint text not null,
  item jsonb not null,
  feed_title text not null,
  status text not null default 'pending' check(status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  observed_at timestamptz not null default now(),
  leased_until timestamptz,
  lease_token uuid,
  last_error text,
  unique(source_id,source_url)
);
create index feed_entries_queue on public.feed_entries(available_at,id) where status in ('pending','processing');
alter table public.feed_entries enable row level security;
revoke all on public.feed_entries from public,anon,authenticated;
grant all on public.feed_entries to service_role;
grant usage,select on sequence public.feed_entries_id_seq to service_role;

create function public.stage_feed_entries(p_source text,p_token uuid,p_entries jsonb)
returns integer language plpgsql set search_path=public as $$
declare total integer;
begin
  perform 1 from sources where id=p_source and lease_token=p_token and leased_until>now() for no key update;
  if not found then raise exception 'Source lease expired or replaced'; end if;
  if jsonb_array_length(p_entries)>500 then raise exception 'Entry batch too large'; end if;
  insert into feed_entries as existing(source_id,source_url,fingerprint,item,feed_title)
    select p_source,r.url,r.fingerprint,r.item,r.feed_title
    from jsonb_to_recordset(p_entries) as r(url text,fingerprint text,item jsonb,feed_title text)
  on conflict(source_id,source_url) do update set
    fingerprint=excluded.fingerprint,item=excluded.item,feed_title=excluded.feed_title,
    observed_at=case when existing.fingerprint<>excluded.fingerprint then now() else existing.observed_at end,
    status=case when existing.fingerprint<>excluded.fingerprint
      or (existing.status='done' and (select adapter from sources where id=p_source)='article')
      then 'pending' else existing.status end,
    attempts=case when existing.fingerprint<>excluded.fingerprint or existing.status='done' then 0 else existing.attempts end,
    available_at=case when existing.fingerprint<>excluded.fingerprint or existing.status='done' then now() else existing.available_at end,
    lease_token=case when existing.fingerprint<>excluded.fingerprint then null else existing.lease_token end,
    leased_until=case when existing.fingerprint<>excluded.fingerprint then null else existing.leased_until end,
    last_error=case when existing.fingerprint<>excluded.fingerprint then null else existing.last_error end;
  get diagnostics total=row_count;
  return total;
end; $$;

create function public.claim_feed_entry() returns table(entry jsonb,source jsonb)
language plpgsql set search_path=public as $$
declare job feed_entries;
begin
  update feed_entries set status='failed',last_error='lease_expired'
    where status='processing' and leased_until<=now() and attempts>=5;
  update feed_entries set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),leased_until=now()+interval '2 minutes'
  where id=(select e.id from feed_entries e join sources s on s.id=e.source_id
    where s.enabled and e.attempts<5 and e.available_at<=now()
      and (e.status='pending' or (e.status='processing' and e.leased_until<=now()))
    order by e.available_at,e.id for update of e skip locked limit 1)
  returning * into job;
  if found then return query select to_jsonb(job),to_jsonb(s) from sources s where s.id=job.source_id; end if;
end; $$;

create function public.complete_feed_entry(p_id bigint,p_token uuid,p_body text,p_hash text,p_published timestamptz,p_skipped boolean default false)
returns boolean language plpgsql set search_path=public as $$
declare job feed_entries; added boolean:=false;
begin
  select * into job from feed_entries where id=p_id and status='processing'
    and lease_token=p_token and leased_until>now() for update;
  if not found then raise exception 'Entry lease expired or replaced'; end if;
  if not p_skipped then
    if p_body is null or length(p_body)=0 or length(p_body)>50000 then raise exception 'Invalid document body'; end if;
    added:=enqueue_document(job.source_id,job.source_url,p_hash,p_body,p_published);
  end if;
  update feed_entries set status='done',lease_token=null,leased_until=null,last_error=null where id=p_id;
  return added;
end; $$;

create function public.fail_feed_entry(p_id bigint,p_token uuid,p_reason text)
returns void language sql set search_path=public as $$
  update feed_entries set status=case when attempts>=5 then 'failed' else 'pending' end,
    available_at=now()+power(2,attempts)*interval '1 minute',
    leased_until=null,lease_token=null,last_error=left(p_reason,80)
  where id=p_id and status='processing' and lease_token=p_token;
$$;

-- Preserve the exact source spelling in payload; normalized keys are subscription indexes.
create function public.technology_key(value text) returns text
language sql immutable set search_path=public as $$
  select trim(both '-' from regexp_replace(lower(value),'[^a-z0-9]+','-','g'));
$$;
create function public.text_union(a text[],b text[]) returns text[]
language sql immutable set search_path=public as $$
  select coalesce(array_agg(distinct v order by v) filter(where v<>''),'{}') from unnest(a||b) v;
$$;
alter table public.events add column technologies text[] not null default '{}',
  add column cve_ids text[] not null default '{}',add column event_types text[] not null default '{}';
update public.events e set
  technologies=text_union(array[e.source_id],array(select technology_key(p->'name'->>'value') from jsonb_array_elements(coalesce(e.payload->'products','[]')) p)),
  cve_ids=array(select c->>'value' from jsonb_array_elements(coalesce(e.payload->'related_cves','[]')) c),
  event_types=array[e.payload->>'kind'];
-- Carry prior routing keys forward for existing revisions as well.
update public.events e set
  technologies=(select coalesce(array_agg(distinct k),'{}') from events h cross join lateral unnest(h.technologies) k where h.advisory_id=e.advisory_id and h.id<=e.id),
  cve_ids=(select coalesce(array_agg(distinct k),'{}') from events h cross join lateral unnest(h.cve_ids) k where h.advisory_id=e.advisory_id and h.id<=e.id),
  event_types=(select coalesce(array_agg(distinct k),'{}') from events h cross join lateral unnest(h.event_types) k where h.advisory_id=e.advisory_id and h.id<=e.id);
create index events_technologies on public.events using gin(technologies);
create index events_cves on public.events using gin(cve_ids);
create index events_types on public.events using gin(event_types);

create or replace function public.finish_document(document_id bigint,token uuid,result jsonb,model_name text)
returns void language plpgsql set search_path=public as $$
declare doc documents; advisory advisories; previous events; next_payload jsonb:=result;
  method text:='llm'; relevant boolean; techs text[]; cves text[]; kinds text[];
begin
  select * into doc from documents where id=document_id and status='processing'
    and lease_token=token and leased_until>now() for update;
  if not found then raise exception 'Lease expired or replaced'; end if;
  if jsonb_typeof(result->'security_relevant') is distinct from 'boolean' then raise exception 'Invalid extraction'; end if;
  relevant:=(result->>'security_relevant')::boolean;
  perform pg_advisory_xact_lock(719432001);
  select * into advisory from advisories where source_id=doc.source_id and source_url=doc.source_url;
  if found and advisory.latest_document_id>=doc.id then
    update documents set status='done',leased_until=null,lease_token=null where id=doc.id;
    return;
  end if;
  if advisory.id is null then
    insert into advisories(source_id,source_url,latest_document_id,revision)
      values(doc.source_id,doc.source_url,doc.id,0) returning * into advisory;
  else
    update advisories set latest_document_id=doc.id where id=advisory.id;
  end if;
  select * into previous from events where advisory_id=advisory.id order by id desc limit 1;
  if not relevant and previous.id is not null and previous.payload->>'kind'<>'withdrawal' then
    -- This is a correction to OUR extraction, not an assertion that the publisher retracted anything.
    next_payload:=jsonb_build_object('security_relevant',true,'kind','withdrawal',
      'title','Previous extraction withdrawn','summary','A newer source revision was classified as non-security. The previous extraction is no longer current; this is not a publisher retraction.',
      'evidence','','products','[]'::jsonb,'related_cves','[]'::jsonb,'severity','unknown','severity_evidence',null,
      'correction_reason','reclassified_non_security','supersedes_event_id',previous.id);
    relevant:=true; method:='system';
  end if;
  if relevant then
    techs:=text_union(coalesce(previous.technologies,'{}'),text_union(array[doc.source_id],
      array(select technology_key(p->'name'->>'value') from jsonb_array_elements(coalesce(next_payload->'products','[]')) p)));
    cves:=text_union(coalesce(previous.cve_ids,'{}'),array(select c->>'value' from jsonb_array_elements(coalesce(next_payload->'related_cves','[]')) c));
    kinds:=text_union(coalesce(previous.event_types,'{}'),array[next_payload->>'kind']);
    update advisories set revision=revision+1 where id=advisory.id returning * into advisory;
    insert into events(advisory_id,revision,document_id,source_id,source_url,source_published_at,model,payload,extraction_method,technologies,cve_ids,event_types,extractor_version)
      values(advisory.id,advisory.revision,doc.id,doc.source_id,doc.source_url,doc.source_published_at,model_name,next_payload,method,techs,cves,kinds,'2');
  end if;
  update documents set status='done',leased_until=null,lease_token=null,last_error=null where id=doc.id;
end; $$;

drop function public.fail_document(bigint,uuid);
create function public.fail_document(document_id bigint,token uuid,reason text default 'extraction_failed')
returns void language sql set search_path=public as $$
  update documents set status=case when attempts>=5 then 'failed' else 'pending' end,
    available_at=now()+power(2,attempts)*interval '1 minute',leased_until=null,lease_token=null,last_error=left(reason,80)
    where id=document_id and lease_token=token and status='processing';
$$;

create table public.extraction_budget(hour timestamptz primary key,attempts integer not null default 0);
alter table public.extraction_budget enable row level security;
revoke all on public.extraction_budget from public,anon,authenticated;
grant all on public.extraction_budget to service_role;
drop function public.claim_document();
create function public.claim_document(hourly_limit integer default 1440) returns setof public.documents
language plpgsql set search_path=public as $$
declare bucket timestamptz:=date_trunc('hour',now(),'UTC'); used integer; job documents;
begin
  if hourly_limit<1 or hourly_limit>10000 then raise exception 'Invalid hourly extraction limit'; end if;
  perform pg_advisory_xact_lock(719432002);
  delete from extraction_budget where hour<now()-interval '7 days';
  insert into extraction_budget(hour) values(bucket) on conflict do nothing;
  select attempts into used from extraction_budget where hour=bucket for update;
  if used>=hourly_limit then return; end if;
  update documents set status='failed',last_error='lease_expired'
    where status='processing' and leased_until<=now() and attempts>=5;
  update documents set status='processing',attempts=attempts+1,
    lease_token=gen_random_uuid(),leased_until=now()+interval '3 minutes'
  where id=(select d.id from documents d join sources s on s.id=d.source_id
    where s.enabled and d.attempts<5 and d.available_at<=now()
      and (d.status='pending' or (d.status='processing' and d.leased_until<=now()))
    order by d.id for update of d skip locked limit 1)
  returning * into job;
  if found then
    update extraction_budget set attempts=attempts+1 where hour=bucket;
    return next job;
  end if;
end; $$;

create function public.feed_health() returns jsonb language sql set search_path=public as $$
 select jsonb_build_object(
 'sources_enabled',(select count(*) from sources where enabled),
 'sources_failing',(select count(*) from sources where enabled and consecutive_failures>0),
 'sources_overdue',(select count(*) from sources where enabled and next_poll_at<now()-interval '30 minutes'),
 'collection_pending',(select count(*) from feed_entries where status in ('pending','processing')),
 'collection_failed',(select count(*) from feed_entries where status='failed'),
 'collection_oldest_seconds',(select coalesce(extract(epoch from now()-min(observed_at)),0) from feed_entries where status in ('pending','processing')),
 'extraction_pending',(select count(*) from documents where status in ('pending','processing')),
 'extraction_failed',(select count(*) from documents where status='failed'),
 'extraction_oldest_seconds',(select coalesce(extract(epoch from now()-min(observed_at)),0) from documents where status in ('pending','processing')),
 'extraction_attempts_this_hour',(select coalesce(sum(attempts),0) from extraction_budget where hour=date_trunc('hour',now(),'UTC')),
 'latest_event_at',(select max(published_at) from events)
 ); $$;
revoke all on function public.stage_feed_entries(text,uuid,jsonb),public.claim_feed_entry(),
 public.complete_feed_entry(bigint,uuid,text,text,timestamptz,boolean),public.fail_feed_entry(bigint,uuid,text),
 public.claim_document(integer),public.fail_document(bigint,uuid,text),public.feed_health(),
 public.technology_key(text),public.text_union(text[],text[]) from public,anon,authenticated;
grant execute on function public.stage_feed_entries(text,uuid,jsonb),public.claim_feed_entry(),
 public.complete_feed_entry(bigint,uuid,text,text,timestamptz,boolean),public.fail_feed_entry(bigint,uuid,text),
 public.claim_document(integer),public.fail_document(bigint,uuid,text),public.feed_health(),
 public.technology_key(text),public.text_union(text[],text[]) to service_role;
