-- Preserve the direction of OSV upstream relationships when enriching priority.
set local lock_timeout='5s';
set local statement_timeout='30s';
select pg_advisory_xact_lock(719432001);

create or replace function public.event_priority(e public.events) returns jsonb
language plpgsql stable set search_path=public as $$
declare own text:=coalesce(e.payload->>'severity','unknown'); effective text; links jsonb; ratings jsonb:='[]';
  link jsonb; rating record; exploited boolean:=false; fixes boolean; reasons text[]:='{}'; rejected boolean;
begin
  if e.payload->>'kind'='withdrawal' then own:='unknown'; end if;
  if severity_rank(own)=0 then own:='unknown'; end if;
  effective:=own;
  exploited:=e.payload->>'kind'<>'withdrawal' and coalesce(e.payload#>>'{structured,exploitation,known_exploited}'='true',false);
  fixes:=e.payload->>'kind'<>'withdrawal' and exists(select 1 from jsonb_array_elements(coalesce(e.payload->'products','[]')) p
    where jsonb_array_length(coalesce(p->'fixed_versions','[]'))>0);
  links:=event_cve_links(e);
  for link in select * from jsonb_array_elements(links) loop
    -- A rejected current CVE record cannot borrow an old OSV rating.
    select coalesce((select x.payload->>'kind'='withdrawal' from events x
      where x.source_id='core-cve' and x.payload#>>'{structured,id}'=link->>'cve'
      order by x.id desc limit 1),false) into rejected;
    for rating in
      select x.* from (
        select distinct on (v.advisory_id) v.* from events v
        where v.advisory_id<>e.advisory_id and v.source_id in ('core-cve','core-osv','core-kev') and v.cve_ids @> array[link->>'cve']
        order by v.advisory_id,v.id desc
      ) x where x.payload->>'kind'<>'withdrawal'
        and exists(select 1 from jsonb_array_elements(coalesce(x.payload->'related_cves','[]')) c where c->>'value'=link->>'cve')
        -- A distribution advisory may consume upstream CVE context, but its
        -- own package rating must not flow back into that CVE or sibling packages.
        and (x.source_id<>'core-osv' or x.payload#>>'{structured,id}'=link->>'cve'
          or coalesce(x.payload#>'{structured,aliases}','[]') ? (link->>'cve'))
        and (x.source_id='core-kev' or not rejected)
      order by x.source_id,x.source_url
    loop
      if severity_rank(rating.payload->>'severity')>severity_rank(effective) then effective:=rating.payload->>'severity'; end if;
      if rating.payload#>>'{structured,exploitation,known_exploited}'='true' then exploited:=true; end if;
      if severity_rank(rating.payload->>'severity')>0 or rating.payload#>>'{structured,exploitation,known_exploited}'='true' then
        ratings:=ratings||jsonb_build_array(jsonb_build_object(
          'cve',link->>'cve','relationship',link->>'relationship','relationship_evidence',link->>'evidence',
          'source_id',rating.source_id,'source_url',rating.source_url,
          'severity',coalesce(rating.payload->>'severity','unknown'),
          'products',coalesce(rating.payload->'products','[]'),
          'metrics',coalesce(rating.payload#>'{structured,metrics}','[]'),
          'known_exploited',coalesce(rating.payload#>>'{structured,exploitation,known_exploited}'='true',false)));
      end if;
    end loop;
  end loop;
  if severity_rank(own)>=3 then reasons:=array_append(reasons,'publisher_severity'); end if;
  if exists(select 1 from jsonb_array_elements(ratings) r where severity_rank(r->>'severity')>=3) then reasons:=array_append(reasons,'linked_severity'); end if;
  if exploited then reasons:=array_append(reasons,'known_exploited'); end if;
  if fixes and effective='unknown' then reasons:=array_append(reasons,'unrated_security_fix'); end if;
  return jsonb_build_object('severity',effective,'publisher_severity',own,'linked_cves',ratings,
    'fix_available',coalesce(fixes,false),'known_exploited',exploited,'reasons',to_jsonb(reasons));
end; $$;
