-- A small searchable dictionary; feed reads still use the canonical item table.
-- Supabase CLI does not supply a transaction for the lock, backfill and triggers.
begin;
set local lock_timeout='5s';
set local statement_timeout='2min';
set local search_path=public,extensions;
create extension if not exists pg_trgm;

-- Keep the initial counts and subsequent writes consistent during installation.
lock table public.feed_items in share row exclusive mode;
create table public.feed_technologies (
  value text collate "C" primary key check(length(value) between 1 and 100),
  item_count bigint not null check(item_count>=0)
);
insert into public.feed_technologies(value,item_count)
select key,count(*) from public.feed_items f
cross join lateral (select distinct unnest(f.technology_ids) key) t
where f.active and length(key) between 1 and 100 group by key;
create index feed_technologies_search on public.feed_technologies using gin(value gin_trgm_ops) with(fastupdate=off);

create function public.sync_feed_technologies() returns trigger language plpgsql set search_path=public as $$
declare old_values text[]:='{}'; new_values text[]:='{}'; change record;
begin
  if tg_op='TRUNCATE' then truncate feed_technologies; return null; end if;
  if tg_op='UPDATE' and (old.active,old.technology_ids) is not distinct from (new.active,new.technology_ids) then return null; end if;
  if tg_op<>'INSERT' and old.active then old_values:=old.technology_ids; end if;
  if tg_op<>'DELETE' and new.active then new_values:=new.technology_ids; end if;
  for change in
    select key,sum(delta) delta from (
      select distinct unnest(new_values) key,1 delta
      union all select distinct unnest(old_values) key,-1 delta
    ) changes where length(key) between 1 and 100
    group by key having sum(delta)<>0 order by key collate "C"
  loop
    if change.delta>0 then
      insert into feed_technologies(value,item_count) values(change.key,1)
      on conflict(value) do update set item_count=feed_technologies.item_count+1;
    else
      update feed_technologies set item_count=item_count-1 where value=change.key;
      delete from feed_technologies where value=change.key and item_count=0;
    end if;
  end loop;
  return null;
end; $$;
create trigger sync_feed_technologies after insert or update of active,technology_ids or delete on public.feed_items
for each row execute function public.sync_feed_technologies();
create trigger truncate_feed_technologies after truncate on public.feed_items
for each statement execute function public.sync_feed_technologies();

alter table public.feed_technologies enable row level security;
revoke all on public.feed_technologies from public,anon,authenticated;
grant all on public.feed_technologies to service_role;
revoke all on function public.sync_feed_technologies() from public,anon,authenticated;
grant execute on function public.sync_feed_technologies() to service_role;
commit;
