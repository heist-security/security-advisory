-- Add indexed family matching without rewriting event history or extraction data.
-- Regex snapshot of src/lib/technology-families.json. Changes require a new
-- migration and rebuilding this expression index, not editing an applied file.
set local lock_timeout='5s';
set local statement_timeout='60s';
create function public.canonical_technology(value text) returns text
language sql immutable parallel safe set search_path=public as $$
  -- Dispatch by the first key segment so unrelated packages skip all regexes.
  select case split_part(key,'-',1)
    when 'node' then case
      when key ~ '^(node|nodejs|node-js)(-v?[0-9]+(-[0-9]+){0,3})?(-lts)?$' then 'node-js'
      else key end
    when 'nodejs' then case
      when key ~ '^(node|nodejs|node-js)(-v?[0-9]+(-[0-9]+){0,3})?(-lts)?$' then 'node-js'
      else key end
    when 'python' then case
      when key ~ '^(python|cpython|python2|python3)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'python'
      else key end
    when 'cpython' then case
      when key ~ '^(python|cpython|python2|python3)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'python'
      else key end
    when 'python2' then case
      when key ~ '^(python|cpython|python2|python3)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'python'
      else key end
    when 'python3' then case
      when key ~ '^(python|cpython|python2|python3)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'python'
      else key end
    when 'ruby' then case
      when key ~ '^ruby(-v?[0-9]+(-[0-9]+){0,3})?$' then 'ruby'
      when key ~ '^(rails|ruby-on-rails|rubyonrails)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'rails'
      else key end
    when 'php' then case
      when key ~ '^(php|php5|php7|php8)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'php'
      else key end
    when 'php5' then case
      when key ~ '^(php|php5|php7|php8)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'php'
      else key end
    when 'php7' then case
      when key ~ '^(php|php5|php7|php8)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'php'
      else key end
    when 'php8' then case
      when key ~ '^(php|php5|php7|php8)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'php'
      else key end
    when 'go' then case
      when key ~ '^(go|golang)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'go'
      else key end
    when 'golang' then case
      when key ~ '^(go|golang)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'go'
      else key end
    when 'java' then case
      when key ~ '^(java|java-se)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'java'
      else key end
    when 'openjdk' then case
      when key ~ '^openjdk(-v?[0-9]+(-[0-9]+){0,3})?$' then 'openjdk'
      else key end
    when 'oracle' then case
      when key ~ '^oracle-java-se(-v?[0-9]+(-[0-9]+){0,3})?$' then 'oracle-java-se'
      else key end
    when 'openssl' then case
      when key ~ '^openssl(-v?[0-9]+(-[0-9]+){0,3})?$' then 'openssl'
      else key end
    when 'postgres' then case
      when key ~ '^(postgres|postgresql)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'postgresql'
      else key end
    when 'postgresql' then case
      when key ~ '^(postgres|postgresql)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'postgresql'
      else key end
    when 'kubernetes' then case
      when key ~ '^(kubernetes|k8s)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'kubernetes'
      else key end
    when 'k8s' then case
      when key ~ '^(kubernetes|k8s)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'kubernetes'
      else key end
    when 'nginx' then case
      when key ~ '^nginx(-v?[0-9]+(-[0-9]+){0,3})?$' then 'nginx'
      else key end
    when 'react' then case
      when key ~ '^react(-v?[0-9]+(-[0-9]+){0,3})?$' then 'react'
      else key end
    when 'vue' then case
      when key ~ '^(vue|vuejs|vue-js)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'vue-js'
      else key end
    when 'vuejs' then case
      when key ~ '^(vue|vuejs|vue-js)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'vue-js'
      else key end
    when 'rails' then case
      when key ~ '^(rails|ruby-on-rails|rubyonrails)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'rails'
      else key end
    when 'rubyonrails' then case
      when key ~ '^(rails|ruby-on-rails|rubyonrails)(-v?[0-9]+(-[0-9]+){0,3})?$' then 'rails'
      else key end
    else key end from (select public.technology_key(value) as key) normalized;
$$;
create function public.technology_family_keys(keys text[]) returns text[]
language sql immutable parallel safe set search_path=public as $$
  select coalesce(array_agg(distinct public.canonical_technology(key) order by public.canonical_technology(key)),array[]::text[])
  from unnest(keys) key;
$$;
-- An unnamed row argument exposes this as a computed field rather than an RPC.
-- Keep this wrapper inlineable so filters match the expression index below.
create function public.technology_families(public.events) returns text[]
language sql immutable parallel safe as $$
  select public.technology_family_keys($1.technologies);
$$;
create index events_technology_families on public.events using gin(public.technology_family_keys(technologies));
revoke all on function public.canonical_technology(text),public.technology_family_keys(text[]),public.technology_families(public.events) from public,anon,authenticated;
grant execute on function public.canonical_technology(text),public.technology_family_keys(text[]),public.technology_families(public.events) to service_role;
notify pgrst, 'reload schema';
