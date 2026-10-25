-- Keep the original migration's schema compatible with projects where 008
-- completed. A failed production 008 is retried with its full-table DML removed.
set local lock_timeout='5s';
set local statement_timeout='30s';
create table public.priority_backfill (
  singleton boolean primary key default true check(singleton),
  last_id bigint not null default 0,
  completed_at timestamptz
);
insert into public.priority_backfill default values;
alter table public.priority_backfill enable row level security;
revoke all on public.priority_backfill from public,anon,authenticated;
grant all on public.priority_backfill to service_role;

create function public.backfill_event_priority(p_limit integer default 100)
returns table(last_id bigint, processed integer, done boolean)
language plpgsql set search_path=public as $$
declare checkpoint priority_backfill; target events; previous events; calculated jsonb; count_rows integer:=0;
begin
  if p_limit<1 or p_limit>200 then raise exception 'Invalid batch size'; end if;
  -- Same ordering as publication; no schema lock, and no intermediate cursor
  -- commits. Both the data and checkpoint roll back if a batch is interrupted.
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
revoke all on function public.backfill_event_priority(integer) from public,anon,authenticated;
grant execute on function public.backfill_event_priority(integer) to service_role;
