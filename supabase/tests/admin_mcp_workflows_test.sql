begin;
select plan(12);
insert into auth.users(id) values ('ad000000-0000-4000-8000-000000000001');
insert into public.staff(id,user_id,first_name,last_name,role,status) values ('ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000001','Workflow','Test','ADMINSTAFF','ACTIVE');
select set_config('request.jwt.claims','{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
create temporary table work(kind text primary key,body jsonb);
insert into work values
('project',public.admin_work_item_change('project',null,null,'project','{"name":"Retention","project_lead_id":"ad000000-0000-4000-8000-000000000002","member_ids":[]}')),
('folder',public.admin_work_item_change('folder',null,null,'folder','{"name":"Procedures"}')),
('issue',public.admin_work_item_change('issue',null,null,'issue','{"name":"Trial questions"}')),
('daily_note',public.admin_work_item_change('daily_note',null,null,'daily','{"date":"2040-01-01","content":"Team note"}')),
('template',public.admin_work_item_change('template',null,null,'template','{"name":"Procedure outline","content":"Steps"}'));
select is((select body#>>'{record,member_ids,0}' from work where kind='project'),'ad000000-0000-4000-8000-000000000002','project lead is a member even if explicit member set omits them');
insert into work select 'document',public.admin_work_item_change('document',null,null,'document',jsonb_build_object('title','Trial procedure','folder_id',(select body#>>'{record,id}' from work where kind='folder'),'project_id',(select body#>>'{record,id}' from work where kind='project'),'is_tutor_documentation',true));
select is((select body#>>'{record,is_tutor_documentation}' from work where kind='document'),'true','document may be tutor-visible immediately');
insert into work select 'task',public.admin_work_item_change('task',null,null,'task',jsonb_build_object('title','Update procedure','project_id',(select body#>>'{record,id}' from work where kind='project'),'assigned_to','ad000000-0000-4000-8000-000000000002','priority',2,'estimate',3));
select is((select body#>>'{record,estimate}' from work where kind='task'),'3','task properties include estimates and assignee');
insert into work select 'note',public.admin_work_item_change('note',null,null,'note',jsonb_build_object('target_type','project','target_id',(select body#>>'{record,id}' from work where kind='project'),'note','Progress'));
select is((select body#>>'{record,target_type}' from work where kind='note'),'projects','agent progress notes use the existing project UI namespace');
select is((select body#>>'{record,date}' from work where kind='daily_note'),'2040-01-01','daily note uses a shared calendar date');
select is((select body#>>'{record,name}' from work where kind='template'),'Procedure outline','reusable templates are ordinary editable content');
-- A concurrent UI write increments the same revision checked by the MCP mutation.
update public.tasks set title='Changed by staff' where id=(select (body#>>'{record,id}')::uuid from work where kind='task');
select throws_ok(format('select public.admin_work_item_change(''task'',%L,%L,''stale-after-ui'',''{"status":"done"}'')',(select body#>>'{record,id}' from work where kind='task'),(select body->>'revision' from work where kind='task')),'PT409',null,'intervening UI changes invalidate the agent revision without triggering transaction retries');
select throws_ok(format('select public.admin_work_item_change(''folder'',%L,%L,''cycle'',%L)',(select body#>>'{record,id}' from work where kind='folder'),(select body->>'revision' from work where kind='folder'),(select jsonb_build_object('parent_id',body#>>'{record,id}')::text from work where kind='folder')),'22023','Folder hierarchy would contain a cycle','folder mutations prevent cycles');
select throws_ok($$select public.admin_work_item_change('issue',null,null,'bad-reference','{"name":"Bad link","description":{"type":"doc","content":[{"type":"mention","attrs":{"type":"student","id":"ad000000-0000-4000-8000-000000000099"}}]}}')$$,'22023','Referenced entity not found','new rich-text references must resolve');
select ok(jsonb_array_length(public.admin_work_item_history('project',(select (body#>>'{record,id}')::uuid from work where kind='project'),0))>0,'attributable project history can be read through its public interface');
insert into public.admin_mcp_grants(user_id,client_id) values ('ad000000-0000-4000-8000-000000000001','workflow-client');
insert into public.note_document_edit_locks(note_id,locked_by,lock_token)
select (body#>>'{record,id}')::uuid,'ad000000-0000-4000-8000-000000000002','ad000000-0000-4000-8000-000000000003' from work where kind='document';
select set_config('request.jwt.claims','{"sub":"ad000000-0000-4000-8000-000000000001","role":"authenticated","client_id":"workflow-client"}',true);
select throws_ok(format('select public.admin_work_item_change(''document'',%L,%L,''locked-edit'',''{"title":"Agent overwrite"}'')',(select body#>>'{record,id}' from work where kind='document'),(select body->>'revision' from work where kind='document')),'55P03','Document is being edited; retry after its editor releases it','agent respects a live editor lock even when the editor belongs to the same person');
select is((public.admin_work_item_read('document',(select (body#>>'{record,id}')::uuid from work where kind='document'))#>>'{record,title}'),'Trial procedure','rejected locked edit preserves staff content');
select * from finish();
rollback;
