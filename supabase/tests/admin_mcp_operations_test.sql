begin;
select plan(5);
insert into auth.users(id) values ('ab000000-0000-4000-8000-000000000001');
insert into public.staff(id,user_id,first_name,last_name,role,status)
values ('ab000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000001','MCP','Test','ADMINSTAFF','ACTIVE');
select set_config('request.jwt.claims','{"sub":"ab000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
create temporary table test_result as select public.admin_work_item_change('task',null,null,'create-test', '{"title":"Investigate retention","status":"todo"}') as result;
select is((select result->'record'->>'title' from test_result),'Investigate retention','creates work through the public mutation interface');
select is(public.admin_work_item_change('task',null,null,'create-test','{"title":"Investigate retention","status":"todo"}'),(select result from test_result),'retry does not duplicate creation');
select throws_ok($$select public.admin_work_item_change('task',null,null,'create-test','{"title":"Different"}')$$,'22023','Idempotency key reused with different input','rejects changed retry payload');
select throws_ok(format('select public.admin_work_item_change(''task'',%L,0,''stale-test'',''{"title":"Overwrite"}'')',(select result->'record'->>'id' from test_result)),'PT409',null,'rejects stale updates without triggering transaction retries');
select throws_ok($$select public.admin_work_item_change('student',null,null,'forbidden-test','{}')$$,'22023','Unsupported work item kind','cannot mutate business records outside operations');
select * from finish();
rollback;
