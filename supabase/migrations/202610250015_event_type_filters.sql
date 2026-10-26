-- Match any selected event type while retaining earlier correction routing keys.
-- Single-type subscriptions and existing RPC callers keep their original semantics.
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(719432001);

create or replace function public.group_event_matches(e public.events,filters jsonb) returns boolean
language sql stable set search_path=public as $$
  select (not filters ? 'type' or e.event_types && string_to_array(filters->>'type',','))
    and (not filters ? 'source' or e.source_id=filters->>'source')
    and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
    and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
    and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
    and (not filters ? 'important' or e.important)
    and (not filters ? 'fix' or e.fix_available)
    and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'));
$$;
create or replace function public.query_advisory_groups(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null,updates boolean default false)
returns setof jsonb language plpgsql stable set search_path=public set plan_cache_mode=force_custom_plan as $$
begin
  if p_limit<1 or p_limit>101 or (p_after is not null and p_before is not null) then raise exception 'Invalid pagination'; end if;
  -- Custom plans eliminate the unused feed branch and constant ORDER BY term,
  -- preserving index pagination after PostgreSQL's generic-plan threshold too.
  return query
  with matching_events as not materialized (
    -- Keep predicates visible to the planner and avoid passing an entire event
    -- (including its potentially large payload) through group_event_matches.
    select e.id from events e
    where (not filters ? 'type' or e.event_types && string_to_array(filters->>'type',','))
      and (not filters ? 'source' or e.source_id=filters->>'source')
      and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
      and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
      and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
      and (not filters ? 'important' or e.important)
      and (not filters ? 'fix' or e.fix_available)
      and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'))
  ), candidates as materialized (
    select * from (
      (select g.latest_update_id as id,g.member_ids as current_ids,g.primary_event_id as current_primary
      from advisory_groups g
      where not updates and g.active
        and (p_after is null or g.latest_update_id>p_after) and (p_before is null or g.latest_update_id<p_before)
        and (not filters ? 'group' or g.id=filters->>'group')
        and (filters-'group'='{}'::jsonb or exists(
          select 1 from advisory_group_members m join matching_events e on e.id=m.event_id where m.group_id=g.id))
      order by case when p_after is not null then g.latest_update_id end asc,g.latest_update_id desc limit p_limit)
      union all
      (select u.id,u.member_ids,u.primary_event_id
      from advisory_group_updates u
      where updates
        and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
        and (not filters ? 'group' or u.group_id=filters->>'group')
        and (filters-'group'='{}'::jsonb or exists(select 1 from matching_events e where e.id=any(u.member_ids)))
      order by case when p_after is not null then u.id end asc,u.id desc limit p_limit)
    ) eligible
    order by case when p_after is not null then id end asc,id desc limit p_limit
  )
  select jsonb_build_object('id',u.id,'group_id',u.group_id,'revision',u.revision,'published_at',u.published_at,
    'change',u.change,'superseded_by',u.superseded_by,
    'primary',public_group_event(p),'changed',public_group_event(ch),
    'members',(select jsonb_agg(public_group_event(e) order by e.id) from events e where e.id=any(c.current_ids)))
  from candidates c join advisory_group_updates u on u.id=c.id
    join events p on p.id=c.current_primary left join events ch on ch.id=u.changed_event_id
  order by case when p_after is not null then c.id end asc,c.id desc;
end; $$;
