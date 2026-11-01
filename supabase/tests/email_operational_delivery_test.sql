BEGIN;
SELECT plan(8);
SET LOCAL ROLE service_role;
CREATE TEMP TABLE operation AS SELECT public.email_operational_prepare('core-invoice/invoice-fixture/parent@example.test',
 '{"to":["parent@example.test"],"email":{"subject":"Invoice ready","html":"<p>Invoice</p>","text":"Invoice"}}','[]',NULL) AS result;
SELECT is((SELECT result->>'proceed' FROM operation),'true','operational delivery durably claims an idempotency key before creating provider mail');
SELECT is(public.email_operational_prepare('core-invoice/invoice-fixture/parent@example.test',
 '{"to":["parent@example.test"],"email":{"subject":"Invoice ready","html":"<p>Invoice</p>","text":"Invoice"}}','[]',NULL)->>'proceed','false','a duplicate operational request cannot create another email');
SELECT throws_ok($$SELECT public.email_operational_prepare('core-invoice/invoice-fixture/parent@example.test','{"to":["other@example.test"]}','[]',NULL)$$,'P0001','Operational email idempotency key has different content','reusing an idempotency key cannot silently deliver different content');
SELECT ok(public.email_operational_update((SELECT (result->>'id')::uuid FROM operation),(SELECT (result->>'token')::uuid FROM operation),'creating','ready','provider-draft'),'the claimed operation records the actual provider draft before submitting it');
INSERT INTO public.students(id,first_name,last_name,email,status) VALUES('fa250100-0000-4000-8000-000000000001','Invoice','Student','invoice-student@example.test','ACTIVE');
CREATE TEMP TABLE linked_operation AS SELECT public.email_operational_prepare('registration/fixture',
 '{"to":["invoice-student@example.test"],"email":{"subject":"Registration","html":"<p>Register</p>","text":"Register"}}',
 '[{"type":"student","id":"fa250100-0000-4000-8000-000000000001"}]',NULL) AS result;
SELECT public.email_operational_update((SELECT (result->>'id')::uuid FROM linked_operation),(SELECT (result->>'token')::uuid FROM linked_operation),'creating','ready','linked-provider-draft');
SELECT public.email_apply_sync_page('op-drafts',NULL,'op-drafts-1',true,'[{"id":"linked-provider-draft","threadId":"op-thread","draft":true,"sender":"admin@altitutor.com","subject":"Registration"}]','{}');
SELECT is((SELECT count(*) FROM public.email_correspondence_for_record('student','fa250100-0000-4000-8000-000000000001')),0::bigint,'an operational draft does not appear as completed correspondence');
SELECT public.email_apply_sync_page('op-sent',NULL,'op-sent-1',true,'[{"id":"linked-provider-draft","threadId":"op-thread","draft":false,"sender":"admin@altitutor.com","sentAt":"2026-10-29T05:00:00Z","subject":"Registration"}]','{}');
SELECT is((SELECT state FROM public.email_operational_sends WHERE idempotency_key='registration/fixture'),'sent','observed operational Sent mail reconciles its existing delivery identity');
SELECT is((SELECT count(*) FROM public.email_correspondence_for_record('student','fa250100-0000-4000-8000-000000000001')),1::bigint,'operational Sent mail appears once in the explicitly relevant Activity correspondence source');
SELECT throws_ok($$SELECT public.email_operational_prepare('invalid-context','{"to":["parent@example.test"],"email":{"subject":"Confirmation"}}','[{"type":"student","id":"fa250100-0000-4000-8000-000000000099"}]',NULL)$$,'P0001','Operational email context record not found','invalid operational context is rejected before any provider delivery');
SELECT * FROM finish();
ROLLBACK;
