-- Choose pagination strategy from a bounded sample of matching events.
-- Broad filters read groups in cursor order until a page is full; sparse
-- filters resolve their complete sample through membership indexes.
-- Read-query replacement only: no publication lock or backfill is needed.
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.query_advisory_groups(filters jsonb default '{}',p_limit integer default 30,p_after bigint default null,p_before bigint default null,updates boolean default false)
returns setof jsonb language plpgsql stable set search_path=public set plan_cache_mode=force_custom_plan as $$
declare matching_ids bigint[]; broad boolean;
begin
  if p_limit<1 or p_limit>101 or (p_after is not null and p_before is not null) then raise exception 'Invalid pagination'; end if;
  if filters-'group'<>'{}'::jsonb then
    select coalesce(array_agg(e.id),'{}') into matching_ids from (
      select e.id from events e where (not filters ? 'type' or e.event_types && string_to_array(filters->>'type',','))
        and (not filters ? 'source' or e.source_id=filters->>'source')
        and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
        and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
        and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
        and (not filters ? 'important' or e.important)
        and (not filters ? 'fix' or e.fix_available)
        and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'))
      limit p_limit*8
    ) e;
    broad:=cardinality(matching_ids)=p_limit*8;
  else
    broad:=true;
  end if;

  -- Custom plans remove unused branches, optional predicates and the constant
  -- ORDER BY term, preserving index pagination even after repeated calls.
  return query
  with matching_groups as materialized (
    select distinct m.group_id from advisory_group_members m
    where not updates and not broad and m.event_id=any(matching_ids)
  ), matching_updates as materialized (
    select distinct u.id,u.member_ids,u.primary_event_id
    from unnest(matching_ids) e(id) cross join lateral (
      select u.id,u.member_ids,u.primary_event_id from advisory_group_updates u
      where u.member_ids @> array[e.id]
        and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
        and (not filters ? 'group' or u.group_id=filters->>'group')
      -- Keep the selective event-first lookup even with inaccurate estimates.
      offset 0
    ) u
    where updates and not broad
  ), candidates as materialized (
    select * from (
      (select g.latest_update_id as id,g.member_ids as current_ids,g.primary_event_id as current_primary
      from advisory_groups g
      where not updates and broad and g.active
        and (p_after is null or g.latest_update_id>p_after) and (p_before is null or g.latest_update_id<p_before)
        and (not filters ? 'group' or g.id=filters->>'group')
        and (filters-'group'='{}'::jsonb or exists(
          select 1 from events e where e.id=any(g.member_ids)
            and (not filters ? 'type' or e.event_types && string_to_array(filters->>'type',','))
            and (not filters ? 'source' or e.source_id=filters->>'source')
            and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
            and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
            and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
            and (not filters ? 'important' or e.important)
            and (not filters ? 'fix' or e.fix_available)
            and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'))))
      order by case when p_after is not null then g.latest_update_id end asc,g.latest_update_id desc limit p_limit)
      union all
      (select g.latest_update_id,g.member_ids,g.primary_event_id
      from matching_groups m join advisory_groups g on g.id=m.group_id
      where g.active
        and (p_after is null or g.latest_update_id>p_after) and (p_before is null or g.latest_update_id<p_before)
        and (not filters ? 'group' or g.id=filters->>'group')
      order by case when p_after is not null then g.latest_update_id end asc,g.latest_update_id desc limit p_limit)
      union all
      (select u.id,u.member_ids,u.primary_event_id
      from advisory_group_updates u
      where updates and broad
        and (p_after is null or u.id>p_after) and (p_before is null or u.id<p_before)
        and (not filters ? 'group' or u.group_id=filters->>'group')
        and (filters-'group'='{}'::jsonb or exists(
          select 1 from events e where e.id=any(u.member_ids)
            and (not filters ? 'type' or e.event_types && string_to_array(filters->>'type',','))
            and (not filters ? 'source' or e.source_id=filters->>'source')
            and (not filters ? 'cve' or e.cve_ids @> array[filters->>'cve'])
            and (not filters ? 'technology' or e.technology_ids && string_to_array(filters->>'technology',',') or e.technologies && string_to_array(filters->>'technology',','))
            and (not filters ? 'severity' or e.severity_keys && array(select jsonb_array_elements_text(filters->'severity')))
            and (not filters ? 'important' or e.important)
            and (not filters ? 'fix' or e.fix_available)
            and (not filters ? 'q' or e.search_document @@ plainto_tsquery('simple',filters->>'q'))))
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
