-- Search the same public event stream used by the web UI, RSS and JSON.
-- Typed text/json arguments and an explicit dictionary make this expression immutable.
create function public.event_search_document(
  source text, payload jsonb, technologies text[], cves text[], kinds text[]
) returns tsvector language sql immutable set search_path=public as $$
  select to_tsvector('simple',source || ' ' || array_to_string(technologies || cves || kinds,' '))
    || jsonb_to_tsvector('simple',payload,'["string"]'::jsonb);
$$;
alter table public.events add column search_document tsvector generated always as (
  public.event_search_document(source_id,payload,technologies,cve_ids,event_types)
) stored;
create index events_search_document on public.events using gin(search_document);
revoke all on function public.event_search_document(text,jsonb,text[],text[],text[]) from public,anon,authenticated;
grant execute on function public.event_search_document(text,jsonb,text[],text[],text[]) to service_role;
