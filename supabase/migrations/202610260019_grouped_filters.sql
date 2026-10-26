-- Resolve every feed filter through the event indexes before loading groups.
-- Sparse type/severity combinations otherwise scan the entire current feed or
-- every historical update, causing intermittent query timeouts as it grows.
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(719432001);

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
  ), matching_updates as materialized (
    -- Probe the snapshot-member index for each matching event. Combining a
    -- large event-ID array into one GIN overlap scan is expensive for broad
    -- subscriptions. Deduplicate updates before applying cursor pagination.
    select distinct u.id,u.member_ids,u.primary_event_id
    from matching_events e cross join lateral (
      select u.id,u.member_ids,u.primary_event_id from advisory_group_updates u
      where u.member_ids @> array[e.id]
        and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
        and (not filters ? 'group' or u.group_id=filters->>'group')
      -- Preserve event-first lookup even when PostgreSQL overestimates matches.
      offset 0
    ) u
    where updates and filters-'group'<>'{}'::jsonb
  ), candidates as materialized (
    select * from (
      (select g.latest_update_id as id,g.member_ids as current_ids,g.primary_event_id as current_primary
      from advisory_groups g
      where not updates and g.active
        and (p_after is null or g.latest_update_id>p_after) and (p_before is null or g.latest_update_id<p_before)
        and (not filters ? 'group' or g.id=filters->>'group')
        and (filters-'group'='{}'::jsonb or
          -- Resolve all filters once using event indexes, then look up current
          -- groups. A correlated EXISTS can scan every group for rare matches.
          g.id=any(array(select m.group_id from matching_events e
            join advisory_group_members m on m.event_id=e.id)))
      order by case when p_after is not null then g.latest_update_id end asc,g.latest_update_id desc limit p_limit)
      union all
      (select u.id,u.member_ids,u.primary_event_id
      from advisory_group_updates u
      where updates and filters-'group'='{}'::jsonb
        and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
        and (not filters ? 'group' or u.group_id=filters->>'group')
      order by case when p_after is not null then u.id end asc,u.id desc limit p_limit)
      union all
      (select u.id,u.member_ids,u.primary_event_id from matching_updates u
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
