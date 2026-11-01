BEGIN;
SELECT plan(8);
INSERT INTO public.parents (id,first_name,last_name) VALUES
 ('20000000-0000-0000-0000-000000000001','Pat','Opt-out'),
 ('20000000-0000-0000-0000-000000000002','Absent','Parent');
INSERT INTO public.sessions (id,type,start_at,end_at,status)
VALUES ('fc294000-0000-4000-8000-000000000001','TRIAL_SESSION',now()-interval '1 hour',now()-interval '15 minutes','ACTIVE');
INSERT INTO public.sessions_staff (session_id,staff_id,type)
VALUES ('fc294000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000010','MAIN_TUTOR');
CREATE TEMP TABLE text_choice_result AS
SELECT public.create_tutor_log(
 p_session_id => 'fc294000-0000-4000-8000-000000000001',
 p_created_by => '00000000-0000-0000-0000-000000000001',
 p_logged_for_staff_id => '00000000-0000-0000-0000-000000000010',
 p_student_attendance => '[{"studentId":"10000000-0000-0000-0000-000000000001","attended":true,"sendAutomatedText":false},{"studentId":"10000000-0000-0000-0000-000000000002","attended":true}]',
 p_parent_attendance => '[{"parentId":"20000000-0000-0000-0000-000000000001","attended":true,"sendAutomatedText":false},{"parentId":"20000000-0000-0000-0000-000000000002","attended":false}]'
) AS payload;
SELECT is((SELECT payload->>'success' FROM text_choice_result),'true','log submission succeeds');
SELECT is((SELECT automated_text_suppressed_student_ids FROM public.tutor_logs WHERE session_id='fc294000-0000-4000-8000-000000000001'),ARRAY['10000000-0000-0000-0000-000000000001']::uuid[],'only explicitly disabled student is excluded');
SELECT is((SELECT automated_text_suppressed_parent_ids FROM public.tutor_logs WHERE session_id='fc294000-0000-4000-8000-000000000001'),ARRAY['20000000-0000-0000-0000-000000000001']::uuid[],'parent choice is independent');
SELECT is((SELECT attended FROM public.tutor_logs_student_attendance WHERE tutor_log_id=(SELECT (payload->>'tutor_log_id')::uuid FROM text_choice_result) AND student_id='10000000-0000-0000-0000-000000000001'),true,'text opt-out leaves attendance intact');
SELECT is((SELECT automated_text_suppressed_student_ids FROM public.tutor_logs WHERE id=(SELECT id FROM public.tutor_logs WHERE session_id<>'fc294000-0000-4000-8000-000000000001' LIMIT 1)),ARRAY[]::uuid[],'existing logs default to no exclusions');
INSERT INTO public.automation_rules(id,name,entity_type,event_names)
VALUES ('fc294000-0000-4000-8000-000000000010','Opt-out contract','tutor_logs',ARRAY['session.logged']);
INSERT INTO public.automation_actions(id,rule_id,action_type,action_config)
VALUES ('fc294000-0000-4000-8000-000000000020','fc294000-0000-4000-8000-000000000010','SEND_MESSAGE','{}');
INSERT INTO public.automation_executions(id,rule_id,entity_type,entity_id,event_type,source_key,status)
VALUES ('fc294000-0000-4000-8000-000000000030','fc294000-0000-4000-8000-000000000010','tutor_logs','fc294000-0000-4000-8000-000000000001','session.logged','dev294-opt-out','PROCESSING');
SELECT public.record_automation_message_skip('fc294000-0000-4000-8000-000000000030','fc294000-0000-4000-8000-000000000020','RECIPIENTS_DISABLED_FOR_LOG');
SELECT is((SELECT reason FROM public.automation_message_action_skips WHERE execution_id='fc294000-0000-4000-8000-000000000030'),'RECIPIENTS_DISABLED_FOR_LOG','explicit all-off records a terminal intentional skip');
SELECT is((SELECT count(*) FROM public.notifications WHERE dedupe_key LIKE 'automation:message-skip:fc294000-0000-4000-8000-000000000030:%'),0::bigint,'intentional opt-outs do not create missing-contact warnings');
SELECT ok(NOT has_function_privilege('authenticated','public.record_automation_message_skip(uuid,uuid,text)','EXECUTE'),'intentional skip RPC remains service-only');
SELECT * FROM finish();
ROLLBACK;
