BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path = public, extensions;
SELECT plan(28);
INSERT INTO public.staff(id, first_name, last_name, role, status)
VALUES ('de253000-0000-4000-8000-000000000001','Recovery','Admin','ADMINSTAFF','ACTIVE');
INSERT INTO public.students(id, first_name, last_name, phone, status)
VALUES ('de253000-0000-4000-8000-000000000002','Recovery','Student','+61400999253','ACTIVE');
INSERT INTO public.owned_numbers(id,phone_e164,provider)
VALUES ('de253000-0000-4000-8000-000000000003','+61400999254','TWILIO');
INSERT INTO public.automation_rules(id,name,entity_type,event_names)
VALUES ('de253000-0000-4000-8000-000000000010','Recovery rule','students',ARRAY['student.created']);
INSERT INTO public.automation_actions(id,rule_id,action_type,action_config)
VALUES ('de253000-0000-4000-8000-000000000020','de253000-0000-4000-8000-000000000010','SEND_MESSAGE','{}');
INSERT INTO public.automation_executions(id,rule_id,entity_type,entity_id,event_type,source_key,status)
VALUES ('de253000-0000-4000-8000-000000000030','de253000-0000-4000-8000-000000000010','students','de253000-0000-4000-8000-000000000002','student.created','dev253-recovery','PROCESSING');
INSERT INTO public.conversations(id,contact_id,owned_number_id)
SELECT 'de253000-0000-4000-8000-000000000040',id,'de253000-0000-4000-8000-000000000003'
FROM public.contacts WHERE student_id='de253000-0000-4000-8000-000000000002';
INSERT INTO public.messages(id,conversation_id,direction,body,to_number_e164,status)
VALUES ('de253000-0000-4000-8000-000000000050','de253000-0000-4000-8000-000000000040','OUTBOUND','Original immutable notice','+61400999253','QUEUED');
INSERT INTO public.automation_message_deliveries(id,execution_id,action_id,contact_id,message_id)
SELECT 'de253000-0000-4000-8000-000000000060','de253000-0000-4000-8000-000000000030','de253000-0000-4000-8000-000000000020',contact_id,'de253000-0000-4000-8000-000000000050'
FROM public.conversations WHERE id='de253000-0000-4000-8000-000000000040';
UPDATE public.messages SET status='FAILED',error_code=21211 WHERE id='de253000-0000-4000-8000-000000000050';
SELECT is((SELECT terminal_failure FROM public.automation_message_deliveries WHERE id='de253000-0000-4000-8000-000000000060'),true,'21211 is a durable terminal delivery failure');
SELECT is((SELECT recipient_student_id FROM public.automation_message_deliveries WHERE id='de253000-0000-4000-8000-000000000060'),'de253000-0000-4000-8000-000000000002'::uuid,'intended identity is snapshotted before contact replacement');
SELECT is((SELECT count(*) FROM public.automation_destination_blocks WHERE owned_number_id='de253000-0000-4000-8000-000000000003' AND destination='+61400999253'),1::bigint,'rejected destination is blocked for this sender');
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),1::bigint,'active admin receives one actionable notice');
UPDATE public.messages SET status='FAILED',error_code=21211 WHERE id='de253000-0000-4000-8000-000000000050';
SELECT is((SELECT count(*) FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),1::bigint,'repeated callbacks do not duplicate notice');
SELECT is(public.preview_automation_message_recovery('de253000-0000-4000-8000-000000000050')->>'canSend','false','unchanged rejected phone cannot be recovered');
UPDATE public.students SET phone='+61400999255' WHERE id='de253000-0000-4000-8000-000000000002';
SELECT is(public.preview_automation_message_recovery('de253000-0000-4000-8000-000000000050')->>'canSend','true','replacement contact is found through intended identity');
SELECT is(public.preview_automation_message_recovery('de253000-0000-4000-8000-000000000050')->>'body','Original immutable notice','review preserves the original rendered content');
SELECT throws_ok($$SELECT public.prepare_automation_message_recovery('de253000-0000-4000-8000-000000000050','de253000-0000-4000-8000-000000000001','de253000-0000-4000-8000-000000000099','+61400999255')$$,'P0001','Recipient changed. Review the current details before sending.','stale preview cannot change the target');
CREATE TEMP TABLE recovery_result AS SELECT public.prepare_automation_message_recovery('de253000-0000-4000-8000-000000000050','de253000-0000-4000-8000-000000000001',(SELECT id FROM public.contacts WHERE student_id='de253000-0000-4000-8000-000000000002'),'+61400999255') AS result;
SELECT is((SELECT body FROM public.messages WHERE id=(SELECT (result->>'messageId')::uuid FROM recovery_result)),'Original immutable notice','recovery sends only original content');
SELECT is(public.prepare_automation_message_recovery('de253000-0000-4000-8000-000000000050','de253000-0000-4000-8000-000000000001',(SELECT id FROM public.contacts WHERE student_id='de253000-0000-4000-8000-000000000002'),'+61400999255')->>'created','false','double submit returns reserved recovery');
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM recovery_result),'+61400999255')->>'dispatch','true','one recovery dispatch is claimed');
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM recovery_result),'+61400999255')->>'dispatch','false','another dispatch cannot duplicate recovery');
SELECT is((SELECT resolved_at IS NULL FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),true,'claim without provider acceptance does not resolve notice');
UPDATE public.messages SET status='SENDING',message_sid='SMsynthetic' WHERE id=(SELECT (result->>'messageId')::uuid FROM recovery_result);
SELECT is((SELECT resolved_at IS NOT NULL FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),true,'provider acceptance resolves original failure notice');
INSERT INTO public.automation_destination_blocks(owned_number_id,destination,failed_message_id) VALUES ('de253000-0000-4000-8000-000000000003','+61400999255','de253000-0000-4000-8000-000000000050');
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM recovery_result),'+61400999255')->>'blocked',NULL::text,'accepted recovery retry is harmless even if another failure blocks destination');
DELETE FROM public.automation_destination_blocks WHERE destination='+61400999255';
UPDATE public.messages SET status='UNDELIVERED',error_code=30003 WHERE id=(SELECT (result->>'messageId')::uuid FROM recovery_result);
SELECT is((SELECT resolved_at IS NULL FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),true,'late failure reopens notice');
UPDATE public.messages SET status='SENT' WHERE id=(SELECT (result->>'messageId')::uuid FROM recovery_result);
SELECT is((SELECT status FROM public.messages WHERE id=(SELECT (result->>'messageId')::uuid FROM recovery_result)),'UNDELIVERED','delayed acceptance callback cannot erase terminal failure');
SELECT is((SELECT resolved_at IS NULL FROM public.notifications WHERE staff_id='de253000-0000-4000-8000-000000000001' AND notification_type='AUTOMATION_DESTINATION_FAILED'),true,'notice remains open after delayed acceptance callback');
SELECT ok(NOT has_function_privilege('authenticated','public.prepare_automation_message_recovery(uuid,uuid,uuid,text,uuid)','EXECUTE'),'portal callers cannot prepare privileged recoveries');
SELECT is(public.claim_automation_message_send('de253000-0000-4000-8000-000000000050','+61400999253')->>'dispatch','false','terminal original cannot dispatch again');
CREATE TEMP TABLE second_recovery AS SELECT public.prepare_automation_message_recovery('de253000-0000-4000-8000-000000000050','de253000-0000-4000-8000-000000000001',(SELECT id FROM public.contacts WHERE student_id='de253000-0000-4000-8000-000000000002'),'+61400999255',(SELECT (result->>'messageId')::uuid FROM recovery_result)) AS result;
SELECT is((SELECT result->>'created' FROM second_recovery),'true','an explicitly reviewed known failure can be recovered again');
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM recovery_result),'+61400999255')->>'dispatch','false','superseded recovery can never fall through as an unrestricted send');
UPDATE public.contacts SET is_opted_out=true WHERE student_id='de253000-0000-4000-8000-000000000002';
SELECT throws_ok($$SELECT public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM second_recovery),'+61400999255')$$,'P0001','Recipient changed. Review the current details before sending.','opt-out between review and dispatch is respected');
UPDATE public.contacts SET is_opted_out=false WHERE student_id='de253000-0000-4000-8000-000000000002';
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM second_recovery),'+61400999255')->>'dispatch','true','new eligible recovery has one dispatch claim');
UPDATE public.messages SET status='AMBIGUOUS' WHERE id=(SELECT (result->>'messageId')::uuid FROM second_recovery);
SELECT is(public.preview_automation_message_recovery('de253000-0000-4000-8000-000000000050')->>'canSend','false','unconfirmed provider outcome prevents another recovery');
SELECT lives_ok($$DELETE FROM public.automation_rules WHERE id='de253000-0000-4000-8000-000000000010'$$,'existing automation-rule deletion still succeeds after recovery');
SELECT is(public.claim_automation_message_send((SELECT (result->>'messageId')::uuid FROM second_recovery),'+61400999255')->>'dispatch','false','deleted-rule recovery remains permanently guarded');
SELECT * FROM finish();
ROLLBACK;
