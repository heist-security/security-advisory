alter table public.sources
  add column category text not null default 'uncategorized',
  add column channel text not null default 'mixed-announcements'
    check (channel in ('security-advisories','mixed-announcements','release-notes')),
  add column adapter text not null default 'article' check (adapter in ('article','feed-content')),
  add column homepage text,
  add column discovery_url text,
  add column discovery_notes text,
  add column rationale text,
  add column limitations text,
  add column verification jsonb,
  add column item_url_prefix text,
  add column poll_interval_minutes integer not null default 60 check (poll_interval_minutes between 15 and 1440),
  add column max_feed_bytes integer not null default 2000000 check (max_feed_bytes between 100000 and 10000000),
  add column lease_token uuid,
  add column leased_until timestamptz,
  add column last_checked_at timestamptz,
  add column consecutive_failures integer not null default 0,
  add column etag text,
  add column last_modified text;
create index sources_due on public.sources(next_poll_at) where enabled;

create or replace function public.claim_source() returns setof public.sources
language sql set search_path = public as $$
  update sources set lease_token = gen_random_uuid(), leased_until = now() + interval '5 minutes'
  where id = (select id from sources where enabled and next_poll_at <= now()
    and (leased_until is null or leased_until <= now())
    order by next_poll_at, id for update skip locked limit 1)
  returning *;
$$;

create function public.complete_source(source_id text, token uuid, succeeded boolean, message text,
  new_etag text, new_last_modified text) returns void language plpgsql set search_path = public as $$
begin
  update sources set
    last_checked_at = now(),
    last_polled_at = case when succeeded then now() else last_polled_at end,
    last_error = message,
    consecutive_failures = case when succeeded then 0 else consecutive_failures + 1 end,
    next_poll_at = now() + case when succeeded then poll_interval_minutes * interval '1 minute'
      else least(360, 5 * power(2, least(consecutive_failures, 6))) * interval '1 minute' end,
    etag = case when succeeded then coalesce(new_etag, etag) else null end,
    last_modified = case when succeeded then coalesce(new_last_modified, last_modified) else null end,
    leased_until = null, lease_token = null
  where id = source_id and lease_token = token and leased_until > now();
  if not found then raise exception 'Source lease expired or replaced'; end if;
end;
$$;
revoke all on function public.complete_source(text,uuid,boolean,text,text,text) from public, anon, authenticated;
grant execute on function public.complete_source(text,uuid,boolean,text,text,text) to service_role;
