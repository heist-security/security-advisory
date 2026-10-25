-- Purely synthetic CI data. Trigger registers products beyond the alias catalog.
update events set payload=jsonb_set(payload,'{products}',jsonb_build_array(jsonb_build_object('name',jsonb_build_object('value',case id when 1 then 'Node.js 8' when 2 then 'node-gyp' when 3 then 'nodejs 100' else 'Node.js' end)))) where id<=4;
update events set payload=jsonb_set(payload,'{products}',jsonb_build_array(jsonb_build_object('name',jsonb_build_object('value','Example Engine 7.2')))) where id=1999;
