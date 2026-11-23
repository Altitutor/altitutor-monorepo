begin;
select plan(7);

insert into auth.users(id) values
  ('ac000000-0000-4000-8000-000000000101'),
  ('ac000000-0000-4000-8000-000000000102'),
  ('ac000000-0000-4000-8000-000000000103');
insert into public.staff(id,user_id,first_name,last_name,role,status) values
  ('ac000000-0000-4000-8000-000000000111','ac000000-0000-4000-8000-000000000101','Chat','Owner','ADMINSTAFF','ACTIVE'),
  ('ac000000-0000-4000-8000-000000000112','ac000000-0000-4000-8000-000000000102','Chat','Other','ADMINSTAFF','ACTIVE');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000101","role":"authenticated"}',true);
select lives_ok($$update public.admin_ai_chat_settings set system_prompt = 'Synthetic settings test'$$,
  'staff browser session can update chat settings');
select lives_ok($$insert into public.admin_ai_chat_threads(id,title,messages)
  values ('ac000000-0000-4000-8000-000000000121','Synthetic thread','[]')$$,
  'staff browser session can save its own chat');
select is((select count(*) from public.admin_ai_chat_threads),1::bigint,'thread owner can read their own thread');
select throws_ok($$update public.admin_ai_chat_threads set messages = jsonb_build_array(repeat('x', 512001))$$,
  '23514', null, 'a private transcript cannot exceed the storage bound');

select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000102","role":"authenticated"}',true);
select is((select count(*) from public.admin_ai_chat_threads),0::bigint,'another staff member cannot read the private thread');

select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000101","role":"authenticated","client_id":"external-agent"}',true);
select is((select count(*) from public.admin_ai_chat_threads),0::bigint,'external OAuth clients cannot read chat history');

select set_config('request.jwt.claims','{"sub":"ac000000-0000-4000-8000-000000000103","role":"authenticated"}',true);
select is((select count(*) from public.admin_ai_chat_settings),0::bigint,'other users cannot read chat settings');

select * from finish();
rollback;
