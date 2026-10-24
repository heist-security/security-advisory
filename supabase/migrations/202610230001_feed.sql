-- Run once in a new Supabase project. All writes and reads go through the server.
create table public.sources (
  id text primary key,
  name text not null,
  feed_url text not null,
  allowed_origins text[] not null,
  enabled boolean not null default true,
  next_poll_at timestamptz not null default now(),
  last_polled_at timestamptz,
  last_error text
);
create table public.documents (
  id bigint generated always as identity primary key,
  source_id text not null references public.sources(id),
  source_url text not null,
  content_hash text not null,
  body text not null,
  source_published_at timestamptz,
  observed_at timestamptz not null default now(),
  status text not null default 'pending' check (status in ('pending','processing','done','failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  leased_until timestamptz,
  lease_token uuid,
  last_error text
);
create index documents_queue on public.documents(available_at, id) where status in ('pending','processing');
create index documents_history on public.documents(source_id, source_url, id desc);
create table public.advisories (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.sources(id),
  source_url text not null,
  latest_document_id bigint not null references public.documents(id),
  revision integer not null default 1,
  unique(source_id, source_url)
);
create table public.events (
  id bigint generated always as identity primary key,
  advisory_id uuid not null references public.advisories(id),
  revision integer not null,
  document_id bigint not null unique references public.documents(id),
  source_id text not null references public.sources(id),
  source_url text not null,
  source_published_at timestamptz,
  published_at timestamptz not null default now(),
  extraction_method text not null default 'llm',
  model text not null,
  extractor_version text not null default '1',
  payload jsonb not null,
  unique(advisory_id, revision)
);
create index events_kind on public.events((payload->>'kind'));
create index events_payload on public.events using gin(payload jsonb_path_ops);

alter table public.sources enable row level security;
alter table public.documents enable row level security;
alter table public.advisories enable row level security;
alter table public.events enable row level security;
-- No anon/authenticated policies: public access is a bounded, cached HTTP API.
revoke all on public.sources, public.documents, public.advisories, public.events from anon, authenticated;
grant all on public.sources, public.documents, public.advisories, public.events to service_role;
grant usage, select on sequence public.documents_id_seq, public.events_id_seq to service_role;

create function public.claim_source() returns setof public.sources
language sql set search_path = public as $$
  update sources set next_poll_at = now() + interval '15 minutes'
  where id = (select id from sources where enabled and next_poll_at <= now()
    order by next_poll_at, id for update skip locked limit 1)
  returning *;
$$;

create function public.enqueue_document(source text, url text, hash text, content text, published timestamptz)
returns boolean language plpgsql set search_path = public as $$
declare previous_hash text;
begin
  perform pg_advisory_xact_lock(hashtextextended(source || ':' || url, 0));
  select content_hash into previous_hash from documents
    where source_id = source and source_url = url order by id desc limit 1;
  if previous_hash = hash then return false; end if;
  insert into documents(source_id, source_url, content_hash, body, source_published_at)
    values(source, url, hash, content, published);
  return true;
end;
$$;

create function public.claim_document() returns setof public.documents
language plpgsql set search_path = public as $$
begin
  update documents set status = 'failed', last_error = 'Lease expired after final attempt'
    where status = 'processing' and leased_until <= now() and attempts >= 5;
  return query update documents
    set status = 'processing', attempts = attempts + 1,
      lease_token = gen_random_uuid(), leased_until = now() + interval '3 minutes'
    where id = (select id from documents where attempts < 5 and available_at <= now()
      and (status = 'pending' or (status = 'processing' and leased_until <= now()))
      order by id for update skip locked limit 1)
    returning *;
end;
$$;

create function public.finish_document(document_id bigint, token uuid, result jsonb, model_name text)
returns void language plpgsql set search_path = public as $$
declare doc documents; advisory advisories;
begin
  select * into doc from documents where id = document_id and status = 'processing'
    and lease_token = token and leased_until > now() for update;
  if not found then raise exception 'Lease expired or replaced'; end if;
  if (result->>'security_relevant')::boolean then
    -- Serialize publication so cursor order follows commit order, even across workers.
    perform pg_advisory_xact_lock(719432001);
    select * into advisory from advisories where source_id = doc.source_id and source_url = doc.source_url;
    if not found then
      insert into advisories(source_id, source_url, latest_document_id)
        values(doc.source_id, doc.source_url, doc.id) returning * into advisory;
    elsif advisory.latest_document_id < doc.id then
      update advisories set latest_document_id = doc.id, revision = revision + 1
        where id = advisory.id returning * into advisory;
    else
      update documents set status = 'done', leased_until = null, lease_token = null where id = doc.id;
      return;
    end if;
    insert into events(advisory_id, revision, document_id, source_id, source_url, source_published_at, model, payload)
      values(advisory.id, advisory.revision, doc.id, doc.source_id, doc.source_url, doc.source_published_at, model_name, result);
  end if;
  update documents set status = 'done', leased_until = null, lease_token = null, last_error = null where id = doc.id;
end;
$$;

create function public.fail_document(document_id bigint, token uuid) returns void
language sql set search_path = public as $$
  update documents set status = case when attempts >= 5 then 'failed' else 'pending' end,
    available_at = now() + (power(2, attempts) * interval '1 minute'),
    leased_until = null, lease_token = null, last_error = 'Extraction or validation failed'
  where id = document_id and lease_token = token and status = 'processing';
$$;

revoke all on function public.claim_source(), public.enqueue_document(text,text,text,text,timestamptz),
  public.claim_document(), public.finish_document(bigint,uuid,jsonb,text), public.fail_document(bigint,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_source(), public.enqueue_document(text,text,text,text,timestamptz),
  public.claim_document(), public.finish_document(bigint,uuid,jsonb,text), public.fail_document(bigint,uuid)
  to service_role;

insert into public.sources(id,name,feed_url,allowed_origins) values
  ('ruby','Ruby','https://www.ruby-lang.org/en/feeds/news.rss',array['https://www.ruby-lang.org']),
  ('nodejs','Node.js','https://nodejs.org/en/feed/blog.xml',array['https://nodejs.org']),
  ('oss-security','oss-security','https://seclists.org/rss/oss-sec.rss',array['https://seclists.org']);
