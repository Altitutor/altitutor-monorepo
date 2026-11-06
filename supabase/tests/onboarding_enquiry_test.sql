BEGIN;
SELECT plan(22);
INSERT INTO public.contacts(id, contact_type, phone_e164, parent_id)
VALUES ('fd279000-0000-4000-8000-000000000001','PARENT','+61429927900','60000000-0000-0000-0000-000000000001');
INSERT INTO public.conversations(id,contact_id,owned_number_id)
SELECT 'fd279000-0000-4000-8000-000000000002','fd279000-0000-4000-8000-000000000001',id
FROM public.owned_numbers WHERE is_default AND sender_type='PHONE' LIMIT 1;
INSERT INTO public.messages(id,conversation_id,direction,body,from_number_e164,to_number_e164,status,received_at)
VALUES ('fd279000-0000-4000-8000-000000000003','fd279000-0000-4000-8000-000000000002','INBOUND',
  'Can my children try tutoring?','+61429927900','+61400000000','RECEIVED','2026-11-05T04:00:00Z'),
 ('fd279000-0000-4000-8000-000000000009','fd279000-0000-4000-8000-000000000002','INBOUND',
  'Can we discuss another enquiry?','+61429927900','+61400000000','RECEIVED','2026-11-06T04:00:00Z');
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,status,registered_at) VALUES
 ('fd279000-0000-4000-8000-000000000013','Harper','','DISCONTINUED','2026-08-01T04:00:00Z');
INSERT INTO public.onboarding_journeys(student_id,label,enquiry_at)
VALUES ('fd279000-0000-4000-8000-000000000013','Harper','2026-11-07T04:00:00Z');
CREATE TEMP TABLE enquiry_request AS SELECT '{
  "requestId":"fd279000-0000-4000-8000-000000000004",
  "source":{"kind":"message","id":"fd279000-0000-4000-8000-000000000003"},
  "parent":{"kind":"existing","id":"60000000-0000-0000-0000-000000000001"},
  "assigneeId":"00000000-0000-0000-0000-000000000002",
  "children":[
    {"id":"fd279000-0000-4000-8000-000000000005","kind":"new","firstName":"Riley"},
    {"id":"fd279000-0000-4000-8000-000000000006","kind":"new","firstName":"Casey"},
    {"id":"fd279000-0000-4000-8000-000000000007","kind":"new","firstName":"Jordan"},
    {"id":"fd279000-0000-4000-8000-000000000008","kind":"new","firstName":"Taylor"}],
  "trials":[
    {"startAt":"2030-01-01T01:00:00Z","endAt":"2030-01-01T02:00:00Z","studentIds":["fd279000-0000-4000-8000-000000000005","fd279000-0000-4000-8000-000000000006"]},
    {"startAt":"2030-01-03T01:00:00Z","endAt":"2030-01-03T02:00:00Z","studentIds":["fd279000-0000-4000-8000-000000000007"]}]
}'::jsonb AS payload;
SELECT lives_ok($$SELECT public.create_onboarding_enquiry(payload) FROM enquiry_request$$,'one parent message saves four children and both trial rosters');
SELECT is((SELECT count(*) FROM public.onboarding_journeys WHERE student_id::text LIKE 'fd279000-%' AND enquiry_at='2026-11-05T04:00:00Z'),4::bigint,'each child has its own journey and original message time');
SELECT is((SELECT count(*) FROM public.onboarding_enquiry_messages WHERE message_id='fd279000-0000-4000-8000-000000000003'),4::bigint,'each journey keeps the original message');
SELECT is((SELECT count(DISTINCT session_id) FROM public.sessions_students WHERE student_id::text LIKE 'fd279000-%' AND was_trial),2::bigint,'the shared roster and separate slot create two trials');
SELECT is((SELECT count(*) FROM public.sessions_students WHERE student_id::text LIKE 'fd279000-%' AND was_trial),3::bigint,'only children assigned to slots enter booked trials');
SELECT ok((SELECT status IS NULL FROM public.students WHERE id='fd279000-0000-4000-8000-000000000008'),'unscheduled child is not a Trial Student yet');
SELECT is((SELECT count(*) FROM public.onboarding_action_preferences p JOIN public.onboarding_journeys j ON j.id=p.journey_id
  WHERE j.student_id::text LIKE 'fd279000-%' AND p.assignee_id='00000000-0000-0000-0000-000000000002'
    AND p.action_key=CASE WHEN j.student_id='fd279000-0000-4000-8000-000000000008' THEN 'book_trial' ELSE 'trial_attendance' END),4::bigint,'assignee is recorded on each next action');
SELECT is(public.create_onboarding_enquiry((SELECT payload FROM enquiry_request)),
          public.create_onboarding_enquiry((SELECT payload FROM enquiry_request)),'retry returns the original result');
SELECT throws_ok($$SELECT public.create_onboarding_enquiry(
  (SELECT jsonb_set(payload,'{requestId}','"fd279000-0000-4000-8000-000000000010"') FROM enquiry_request)
)$$,'P0001','An enquiry has already been created from this message','a second request cannot duplicate the same source');
CREATE TEMP TABLE unresolved_family AS
SELECT (public.create_onboarding_enquiry('{
  "requestId":"fd279000-0000-4000-8000-000000000011",
  "source":{"kind":"message","id":"fd279000-0000-4000-8000-000000000009"},
  "parent":{"kind":"existing","id":"60000000-0000-0000-0000-000000000001"}
}') -> 'journeyIds' ->> 0)::uuid AS id;
SELECT ok((SELECT student_id IS NULL AND closed_at IS NULL FROM public.onboarding_journeys WHERE id=(SELECT id FROM unresolved_family)),
  'an unidentified family enquiry is visible until the children are known');
SELECT lives_ok($$SELECT public.create_onboarding_enquiry(jsonb_build_object(
  'requestId','fd279000-0000-4000-8000-000000000012','familyJourneyId',(SELECT id FROM unresolved_family),
  'assigneeId','00000000-0000-0000-0000-000000000002',
  'children','[{"id":"fd279000-0000-4000-8000-000000000013","kind":"existing"}]'::jsonb
))$$,'staff can identify children later without a new message');
SELECT ok((SELECT closed_at IS NOT NULL FROM public.onboarding_journeys WHERE id=(SELECT id FROM unresolved_family)),
  'resolved family entry leaves the open queue');
SELECT is((SELECT count(*) FROM public.onboarding_enquiry_messages m JOIN public.onboarding_journeys j ON j.id=m.journey_id
  WHERE j.student_id='fd279000-0000-4000-8000-000000000013' AND j.enquiry_at='2026-11-06T04:00:00Z'
    AND m.message_id='fd279000-0000-4000-8000-000000000009'),1::bigint,'identified child retains the family date and source');
SELECT throws_ok($$SELECT public.create_onboarding_enquiry('{
  "requestId":"fd279000-0000-4000-8000-000000000014",
  "children":[{"id":"fd279000-0000-4000-8000-000000000015","kind":"new","firstName":"Rollback"}],
  "trials":[
    {"startAt":"2030-01-01T01:00:00Z","endAt":"2030-01-01T02:00:00Z","studentIds":["fd279000-0000-4000-8000-000000000015"]},
    {"startAt":"2030-01-03T01:00:00Z","endAt":"2030-01-03T02:00:00Z","studentIds":["fd279000-0000-4000-8000-000000000015"]}]
}')$$,'P0001','Choose unbooked children from this enquiry for each trial','a second slot cannot book the same child twice');
SELECT is((SELECT count(*) FROM public.students WHERE id='fd279000-0000-4000-8000-000000000015'),0::bigint,'a failed slot rolls back earlier inserts');
SELECT is((SELECT count(DISTINCT session_id) FROM public.sessions_students WHERE student_id::text LIKE 'fd279000-%' AND was_trial),
  2::bigint,'a failed slot does not leave a partial booking');
SELECT throws_ok($$SELECT public.create_onboarding_enquiry(
  (SELECT jsonb_set(payload,'{label}','"Different submitted details"') FROM enquiry_request)
)$$,'P0001','This enquiry was already saved with different details. Check the Trial queue before trying again',
  'an edited retry cannot report a successful save of the previous details');
SELECT throws_ok($$SELECT public.create_onboarding_enquiry(
  (SELECT jsonb_set(jsonb_set(payload,'{requestId}','"fd279000-0000-4000-8000-000000000016"'),
   '{source,id}','"FD279000-0000-4000-8000-000000000003"') FROM enquiry_request)
)$$,'P0001','An enquiry has already been created from this message','alternate UUID spellings cannot bypass source deduplication');
SELECT is((SELECT status FROM public.students WHERE id='fd279000-0000-4000-8000-000000000013'),
  'DISCONTINUED','linking the enquiry preserves Student status');
SELECT ok((public.search_student_directory_admin(
  '{"search":"Harper","filters":{"relationship":["trial"],"queue":["open"]}}',
  (SELECT jsonb_build_array(jsonb_build_object('id',id,'student_id',student_id,'stage','Enquiry','open',true))
   FROM public.onboarding_journeys WHERE student_id='fd279000-0000-4000-8000-000000000013')
)->'entries') @> '[{"id":"fd279000-0000-4000-8000-000000000013"}]'::jsonb,
  'a discontinued Student with an open journey is visible in the Trial queue');
SELECT is((SELECT action_key FROM public.onboarding_action_preferences p JOIN public.onboarding_journeys j ON j.id=p.journey_id
  WHERE j.student_id='fd279000-0000-4000-8000-000000000013' AND p.assignee_id='00000000-0000-0000-0000-000000000002'),
  'enrol','a previously registered Student gets the placement action rather than another trial action');
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.create_onboarding_enquiry('{}')$$,'42501','Active AdminStaff access required','students cannot file enquiries through the transaction');
SELECT * FROM finish();
ROLLBACK;
