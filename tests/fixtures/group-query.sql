-- Synthetic populated feed for query-cost checks. Bypass ingestion triggers
-- while constructing the same current-member/update relationships in bulk.
begin;
set local session_replication_role=replica;
insert into documents(source_id,source_url,content_hash,body,status)
select 'core-cve','https://example.test/query/'||i,i::text,'Query fixture','done'
from generate_series(1,6000) i;
insert into advisories(source_id,source_url,latest_document_id)
select source_id,source_url,id from documents;
insert into events(advisory_id,revision,document_id,source_id,source_url,model,payload,cve_ids,technologies,event_types,group_id)
select a.id,1,d.id,d.source_id,d.source_url,'structured',
  jsonb_build_object('kind','advisory','severity','high','title','Query fixture '||d.id,'products','[]'::jsonb),
  array['CVE-2026-'||(10000+d.id)],array['core-cve'],array['advisory'],'advisory:'||a.id
from advisories a join documents d on d.id=a.latest_document_id;
insert into advisory_groups(id,member_ids,primary_event_id,signatures,context,revision)
select group_id,array[id],id,'{}','{}',1 from events;
insert into advisory_group_members(advisory_id,event_id,group_id)
select advisory_id,id,group_id from events;
insert into advisory_group_updates(group_id,revision,member_ids,primary_event_id,changed_event_id,change,published_at)
select group_id,1,array[id],id,id,'published',published_at from events order by id;
update advisory_groups g set latest_update_id=u.id from advisory_group_updates u where u.group_id=g.id;
commit;
analyze events;
analyze advisory_groups;
analyze advisory_group_members;
analyze advisory_group_updates;
