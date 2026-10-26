-- Synthetic populated feed for query-cost checks. Bypass ingestion triggers
-- while constructing the same current-member/update relationships in bulk.
begin;
set local session_replication_role=replica;
insert into documents(source_id,source_url,content_hash,body,status)
select 'core-cve','https://example.test/query/'||i,i::text,'Query fixture','done'
from generate_series(1,coalesce(nullif(current_setting('test.group_query_rows',true),''),'6000')::integer) i;
insert into advisories(source_id,source_url,latest_document_id)
select source_id,source_url,id from documents;
insert into events(advisory_id,revision,document_id,source_id,source_url,model,payload,cve_ids,technologies,event_types,severity_keys,important,fix_available,group_id)
select a.id,1,d.id,d.source_id,d.source_url,'structured',
  jsonb_build_object('kind',case when d.id in (1,3000) then 'patch' else 'advisory' end,
    'severity',case when d.id in (1,3000) then 'critical' else 'high' end,'title','Query fixture '||d.id,'products','[]'::jsonb,
    'summary',case when d.id in (1,3000) then 'Brotli decoder ' else '' end ||
      (select string_agg(md5(d.id::text||':'||n),' ') from
        generate_series(1,coalesce(nullif(current_setting('test.group_query_words',true),''),'100')::integer) n)),
  array['CVE-2026-'||(10000+d.id)],array['core-cve'],
  case when d.id in (1,3000) then array['patch'] else array['advisory'] end,
  case when d.id in (1,3000) then array['critical'] else array['high'] end,
  d.id in (1,3000),d.id in (1,3000),'advisory:'||a.id
from advisories a join documents d on d.id=a.latest_document_id;
insert into advisory_groups(id,member_ids,primary_event_id,signatures,context,revision)
select group_id,array[id],id,'{}','{}',1 from events;
insert into advisory_group_members(advisory_id,event_id,group_id)
select advisory_id,id,group_id from events;
insert into advisory_group_updates(group_id,revision,member_ids,primary_event_id,changed_event_id,change,published_at)
select group_id,1,array[id],id,id,'published',published_at from events order by id;
update advisory_groups g set latest_update_id=u.id from advisory_group_updates u where u.group_id=g.id;
insert into advisory_feed_members(feed_id,event_id,group_id,source_id,event_types,severity_keys,cve_ids,technology_ids,technologies,important,fix_available,search_document)
select u.id,e.id,u.group_id,e.source_id,e.event_types,e.severity_keys,e.cve_ids,e.technology_ids,e.technologies,e.important,e.fix_available,e.search_document
from advisory_group_updates u join events e on e.id=u.primary_event_id;
insert into advisory_update_members(feed_id,event_id,group_id,source_id,event_types,severity_keys,cve_ids,technology_ids,technologies,important,fix_available,search_document)
select u.id,e.id,u.group_id,e.source_id,e.event_types,e.severity_keys,e.cve_ids,e.technology_ids,e.technologies,e.important,e.fix_available,e.search_document
from advisory_group_updates u join events e on e.id=u.primary_event_id;
commit;
analyze events;
analyze advisory_groups;
analyze advisory_group_members;
analyze advisory_group_updates;
analyze advisory_feed_members;
analyze advisory_update_members;
