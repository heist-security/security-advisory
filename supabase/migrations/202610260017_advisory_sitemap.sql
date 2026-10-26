-- List only occupied sitemap parts using the existing active-group index.
-- Return one JSON value so PostgREST's row cap cannot truncate the index.
set local lock_timeout='5s';
set local statement_timeout='30s';

create function public.advisory_sitemap_parts() returns jsonb
language sql stable set search_path=public as $$
  select coalesce(jsonb_agg(part order by part),'[]'::jsonb)
  from (
    select distinct (latest_update_id-1)/1000 as part
    from advisory_groups
    where active and latest_update_id>0
    order by part
    limit 50000
  ) parts;
$$;

revoke all on function public.advisory_sitemap_parts() from public,anon,authenticated;
grant execute on function public.advisory_sitemap_parts() to service_role;
notify pgrst,'reload schema';
