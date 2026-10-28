BEGIN;
SELECT plan(13);
INSERT INTO public.staff(id,first_name,last_name,role,status) VALUES
 ('de232000-0000-4000-8000-000000000001','Skip','Admin','ADMINSTAFF','ACTIVE'),
 ('de232000-0000-4000-8000-000000000002','Skip','Tutor','TUTOR','ACTIVE');
INSERT INTO public.automation_rules(id,name,entity_type,event_names) VALUES
 ('de232000-0000-4000-8000-000000000010','Synthetic skip rule','sessions',ARRAY['session.student_added']),
 ('de232000-0000-4000-8000-000000000011','Other rule','sessions',ARRAY['session.student_added']);
INSERT INTO public.automation_actions(id,rule_id,action_type,action_config) VALUES
 ('de232000-0000-4000-8000-000000000020','de232000-0000-4000-8000-000000000010','SEND_MESSAGE','{}'),
 ('de232000-0000-4000-8000-000000000021','de232000-0000-4000-8000-000000000011','SEND_MESSAGE','{}'),
 ('de232000-0000-4000-8000-000000000022','de232000-0000-4000-8000-000000000010','SEND_MESSAGE','{}');
INSERT INTO public.automation_executions(id,rule_id,entity_type,entity_id,event_type,source_key,status) VALUES
 ('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000010','sessions','de232000-0000-4000-8000-000000000040','session.student_added','dev232-synthetic-skip','PROCESSING');

SELECT lives_ok($$SELECT public.record_automation_message_skip('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000020')$$,'record a zero-recipient outcome');
SELECT is((SELECT count(*) FROM public.automation_message_action_skips WHERE execution_id='de232000-0000-4000-8000-000000000030'),1::bigint,'one terminal action outcome');
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id='de232000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_MESSAGE_SKIPPED'),1::bigint,'active admin can inspect the skip in the staff inbox');
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id='de232000-0000-4000-8000-000000000002' AND notification_type='AUTOMATION_MESSAGE_SKIPPED'),0::bigint,'tutors receive no admin-only automation evidence');
SELECT lives_ok($$SELECT public.record_automation_message_skip('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000020')$$,'duplicate replay succeeds');
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id='de232000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_MESSAGE_SKIPPED'),1::bigint,'replay does not duplicate the notice');
SELECT throws_ok($$SELECT public.record_automation_message_skip('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000021')$$,'P0001','Message action does not belong to execution','reject an unrelated action');
SELECT is((SELECT status FROM public.automation_executions WHERE id='de232000-0000-4000-8000-000000000030'),'PROCESSING','an action skip never skips the containing execution');

CREATE FUNCTION pg_temp.reject_skip_notice() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'synthetic notification persistence failure'; END; $$;
CREATE TRIGGER dev232_reject_skip_notice BEFORE INSERT ON public.notifications
 FOR EACH ROW WHEN (NEW.notification_type='AUTOMATION_MESSAGE_SKIPPED') EXECUTE FUNCTION pg_temp.reject_skip_notice();
SELECT throws_ok($$SELECT public.record_automation_message_skip('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000022')$$,'P0001','synthetic notification persistence failure','notice and terminal outcome are atomic');
SELECT is((SELECT count(*) FROM public.automation_message_action_skips WHERE action_id='de232000-0000-4000-8000-000000000022'),0::bigint,'failed notice rolls back the outcome so it can be retried');
SELECT ok(NOT has_function_privilege('authenticated','public.record_automation_message_skip(uuid,uuid)','EXECUTE'),'ordinary authenticated callers cannot write terminal outcomes');
SELECT ok(NOT has_function_privilege('anon','public.record_automation_message_skip(uuid,uuid)','EXECUTE'),'anonymous callers cannot write terminal outcomes');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SELECT throws_ok($$SELECT public.record_automation_message_skip('de232000-0000-4000-8000-000000000030','de232000-0000-4000-8000-000000000020')$$,'42501','Service role required','JWT role assertion also protects service-only execution');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
