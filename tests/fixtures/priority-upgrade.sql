-- Synthetic existing production history, loaded before priority migration 008.
insert into documents(source_id,source_url,content_hash,body,status)
select 'core-cve','https://example.test/cve/'||i,i::text,'Synthetic migration fixture','done'
from generate_series(1,2000) i;
insert into advisories(source_id,source_url,latest_document_id)
select source_id,source_url,id from documents;
insert into events(advisory_id,revision,document_id,source_id,source_url,model,payload,cve_ids,technologies,event_types)
select a.id,1,d.id,d.source_id,d.source_url,'structured',
  jsonb_build_object('kind','advisory','severity','high','products','[]'::jsonb,
    'related_cves',jsonb_build_array(jsonb_build_object('value','CVE-2026-'||(10000+d.id))),
    'structured',jsonb_build_object('id','CVE-2026-'||(10000+d.id))),
  array['CVE-2026-'||(10000+d.id)],array['core-cve'],array['advisory']
from advisories a join documents d on d.id=a.latest_document_id;
analyze public.events;
