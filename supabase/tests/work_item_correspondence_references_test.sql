begin;
select plan(9);
insert into auth.users(id) values ('fd277000-0000-4000-8000-000000000001');
insert into public.staff(id,user_id,first_name,last_name,role,status)
values ('fd277000-0000-4000-8000-000000000002','fd277000-0000-4000-8000-000000000001','Reference','Test','ADMINSTAFF','ACTIVE');
insert into public.email_threads(id) values ('dev277-thread');
insert into public.email_messages(id,thread_id,data)
values ('dev277-text-email+id=','dev277-thread','{"id":"dev277-text-email+id=","threadId":"dev277-thread","subject":"Reference fixture"}');
insert into public.owned_numbers(id,phone_e164,provider,sender_type)
values ('fd277000-0000-4000-8000-000000000010','+61400277010','TWILIO','PHONE');
insert into public.contacts(id,phone_e164,contact_type)
values ('fd277000-0000-4000-8000-000000000011','+61400277011','OTHER');
insert into public.conversations(id,contact_id,owned_number_id,status)
values ('fd277000-0000-4000-8000-000000000012','fd277000-0000-4000-8000-000000000011','fd277000-0000-4000-8000-000000000010','OPEN');
insert into public.messages(id,conversation_id,body,direction,status,from_number_e164,to_number_e164)
values ('fd277000-0000-4000-8000-000000000014','fd277000-0000-4000-8000-000000000012','Referenced message','INBOUND','RECEIVED','+61400277011','+61400277010');
select set_config('request.jwt.claims','{"sub":"fd277000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
create temporary table reference_docs(kind text primary key,body jsonb);
insert into reference_docs values
('email','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"type":"email","id":"dev277-text-email+id=","label":"Reference email"}}]}]}'),
('message','{"type":"doc","content":[{"type":"paragraph","content":[{"type":"mention","attrs":{"type":"message","id":"fd277000-0000-4000-8000-000000000014","label":"Reference message"}}]}]}');
select is(
  public.admin_work_item_change('task',null,null,'reference-task',jsonb_build_object('title','Email task','description',(select body from reference_docs where kind='email')))#>>'{record,description,content,0,content,0,attrs,id}',
  'dev277-text-email+id=','tasks persist text email IDs through the authenticated mutation API');
select is(
  public.admin_work_item_change('issue',null,null,'reference-issue',jsonb_build_object('name','Message issue','description',(select body from reference_docs where kind='message')))#>>'{record,description,content,0,content,0,attrs,id}',
  'fd277000-0000-4000-8000-000000000014','issues persist individual message references');
select is(
  public.admin_work_item_change('project',null,null,'reference-project',jsonb_build_object('name','Email project','description',(select body from reference_docs where kind='email')))#>>'{record,description,content,0,content,0,attrs,type}',
  'email','projects support correspondence references');
select is(
  public.admin_work_item_change('document',null,null,'reference-document',jsonb_build_object('title','Message document','content',(select body from reference_docs where kind='message')))#>>'{record,content,content,0,content,0,attrs,type}',
  'message','documents support correspondence without broadening unrelated document links');
select throws_ok($$select public.admin_work_item_change('task',null,null,'missing-email','{"title":"Missing email","description":{"type":"doc","content":[{"type":"mention","attrs":{"type":"email","id":"missing-email"}}]}}')$$,
  '22023','Referenced entity not found','new email references must resolve');
select throws_ok($$select public.admin_work_item_change('issue',null,null,'missing-message','{"name":"Missing message","description":{"type":"doc","content":[{"type":"mention","attrs":{"type":"message","id":"fd277000-0000-4000-8000-000000000099"}}]}}')$$,
  '22023','Referenced entity not found','new message references must resolve');
select throws_ok($$select public.admin_work_item_change('task',null,null,'invalid-message','{"title":"Invalid message","description":{"type":"doc","content":[{"type":"mention","attrs":{"type":"message","id":"not-a-uuid"}}]}}')$$,
  '22023','Invalid reference ID','invalid message IDs are rejected as validation failures');
select throws_ok($$select public.admin_work_item_change('document',null,null,'unrelated-document-reference','{"title":"Unrelated reference","content":{"type":"doc","content":[{"type":"mention","attrs":{"type":"staff","id":"fd277000-0000-4000-8000-000000000002"}}]}}')$$,
  '22023','Documents support document, email and message references only','the existing document reference boundary remains enforced');
select ok(not has_function_privilege('authenticated','admin_operations.validate_references(jsonb,jsonb,boolean)','execute'),'reference validation stays private to the authorized public mutation API');
select * from finish();
rollback;
