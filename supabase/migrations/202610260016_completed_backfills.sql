-- Completed backfills are immutable until explicitly reset by an operator.
-- Read their completion marker before contending with live publication.
-- Incomplete work still acquires the publication lock first and rechecks the
-- checkpoint under its row lock, retaining atomic/resumable batch semantics.
set local lock_timeout='5s';
set local statement_timeout='30s';

create or replace function public.backfill_event_priority(p_limit integer default 100)
returns table(last_id bigint, processed integer, done boolean)
language plpgsql set search_path=public as $$
declare checkpoint priority_backfill; target events; previous events; calculated jsonb; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  -- Same ordering as publication; no schema lock, and no intermediate cursor
  -- commits. Both the data and checkpoint roll back if a batch is interrupted.
  select * into checkpoint from priority_backfill where singleton;
  if checkpoint.completed_at is not null then
    return query select checkpoint.last_id,0,true; return;
  end if;
  perform pg_advisory_xact_lock(719432001);
  select * into checkpoint from priority_backfill where singleton for update;
  if checkpoint.completed_at is not null then
    return query select checkpoint.last_id,0,true; return;
  end if;
  for target in select * from events where id>checkpoint.last_id order by id limit p_limit loop
    -- Preserve snapshots already emitted by live publication or an applied 008.
    calculated:=case when target.priority='{}'::jsonb then event_priority(target) else target.priority end;
    select * into previous from events where advisory_id=target.advisory_id and id<target.id order by id desc limit 1;
    update events set priority=calculated,
      severity_keys=text_union(target.severity_keys,text_union(coalesce(previous.severity_keys,'{}'),array[calculated->>'severity'])),
      important=target.important or coalesce(previous.important,false) or jsonb_array_length(calculated->'reasons')>0,
      fix_available=target.fix_available or coalesce(previous.fix_available,false) or (calculated->>'fix_available')::boolean
      where id=target.id;
    checkpoint.last_id:=target.id; count_rows:=count_rows+1;
  end loop;
  update priority_backfill set last_id=checkpoint.last_id,
    completed_at=case when count_rows<p_limit then clock_timestamp() else null end where singleton;
  return query select checkpoint.last_id,count_rows,count_rows<p_limit;
end; $$;

create or replace function public.backfill_event_technologies(p_limit integer default 100)
returns table(last_id bigint, processed integer, done boolean)
language plpgsql set search_path=public as $$
declare checkpoint technology_backfill; target events; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  select * into checkpoint from technology_backfill where singleton;
  if checkpoint.completed_at is not null then
    return query select checkpoint.last_id,0,true; return;
  end if;
  perform pg_advisory_xact_lock(719432001);
  select * into checkpoint from technology_backfill where singleton for update;
  if checkpoint.completed_at is not null then return query select checkpoint.last_id,0,true; return; end if;
  for target in select * from events where id>checkpoint.last_id order by id limit p_limit loop
    -- Recalculate routing metadata only. No new event, extraction, or timestamp.
    update events set technology_ids=technology_ids where id=target.id;
    checkpoint.last_id:=target.id; count_rows:=count_rows+1;
  end loop;
  update technology_backfill set last_id=checkpoint.last_id,
    completed_at=case when count_rows<p_limit then clock_timestamp() else null end where singleton;
  return query select checkpoint.last_id,count_rows,count_rows<p_limit;
end; $$;

create or replace function public.backfill_advisory_groups(p_limit integer default 100)
returns table(last_id bigint,processed integer,done boolean)
language plpgsql set search_path=public as $$
declare checkpoint advisory_group_backfill; target events; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  select * into checkpoint from advisory_group_backfill where singleton;
  if checkpoint.completed_at is not null then
    return query select checkpoint.last_id,0,true; return;
  end if;
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
