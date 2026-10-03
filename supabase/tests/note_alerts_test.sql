begin;
select plan(10);

insert into auth.users(id) values
  ('ab000000-0000-4000-8000-000000000001'),
  ('ab000000-0000-4000-8000-000000000003');
insert into public.staff(id,user_id,first_name,last_name,role,status) values
  ('ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000001','Alert','Admin','ADMINSTAFF','ACTIVE'),
  ('ab000000-0000-4000-8000-000000000004','ab000000-0000-4000-8000-000000000003','Alert','Tutor','TUTOR','ACTIVE');
insert into public.parents(id,first_name,last_name,created_by) values
  ('ab000000-0000-4000-8000-000000000005','Alert','Parent','ab000000-0000-4000-8000-000000000002');
insert into public.students(id,first_name,last_name,status) values
  ('ab000000-0000-4000-8000-000000000006','Alert','Student','ACTIVE');

select set_config('request.jwt.claims','{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
create temporary table work(kind text primary key,body jsonb);
insert into work values ('original',public.admin_work_item_change('note',null,null,'alert-create',
  '{"target_type":"staff","target_id":"ab000000-0000-4000-8000-000000000002","note":"Needs attention"}'));
select is((select body#>>'{record,is_alert}' from work where kind='original'),'false','ordinary notes default to no alert');
insert into work select 'flagged',public.admin_work_item_change('note',
  (body#>>'{record,id}')::uuid,(body->>'revision')::bigint,'alert-flag','{"is_alert":true}') from work where kind='original';
select is((select body#>>'{record,is_alert}' from work where kind='flagged'),'true','admin can flag a staff note');
select is((select body#>>'{record,note}' from work where kind='flagged'),'Needs attention','flagging preserves the note content');
insert into work select 'edited',public.admin_work_item_change('note',
  (body#>>'{record,id}')::uuid,(body->>'revision')::bigint,'alert-edit','{"note":"Updated attention"}') from work where kind='flagged';
select is((select body#>>'{record,is_alert}' from work where kind='edited'),'true','editing text preserves its alert flag');
select throws_ok(format('select public.admin_work_item_change(''note'',%L,%L,''alert-stale'',''{"is_alert":false}'')',
  (select body#>>'{record,id}' from work where kind='original'),
  (select body->>'revision' from work where kind='original')),'PT409',null,'alert changes respect optimistic concurrency');
insert into work select 'unflagged',public.admin_work_item_change('note',
  (body#>>'{record,id}')::uuid,(body->>'revision')::bigint,'alert-remove','{"is_alert":false}') from work where kind='edited';
select is((select body#>>'{record,is_alert}' from work where kind='unflagged'),'false','removing an alert keeps the note');
select is((public.admin_work_item_change('note',null,null,'parent-alert',
  '{"target_type":"parents","target_id":"ab000000-0000-4000-8000-000000000005","note":"Parent alert","is_alert":true}'))#>>'{record,is_alert}','true','parent notes support alerts');
select is((public.admin_work_item_change('note',null,null,'student-alert',
  '{"target_type":"students","target_id":"ab000000-0000-4000-8000-000000000006","note":"Student alert","is_alert":true}'))#>>'{record,is_alert}','true','student notes support alerts');
insert into work values ('project',public.admin_work_item_change('project',null,null,'alert-project','{"name":"Other target"}'));
select throws_ok(format('select public.admin_work_item_change(''note'',null,null,''unsupported-alert'',%L)',
  (select jsonb_build_object('target_type','project','target_id',body#>>'{record,id}','note','Other','is_alert',true)::text from work where kind='project')),
  '23514',null,'other note targets cannot be flagged as entity alerts');
select set_config('request.jwt.claims','{"sub":"ab000000-0000-4000-8000-000000000003","role":"authenticated"}',true);
select throws_ok($$select public.admin_work_item_change('note',null,null,'tutor-alert',
  '{"target_type":"staff","target_id":"ab000000-0000-4000-8000-000000000002","note":"Unauthorized","is_alert":true}')$$,
  '42501',null,'tutors cannot create admin note alerts');
select * from finish();
rollback;
