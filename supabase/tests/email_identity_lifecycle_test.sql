BEGIN;
SELECT plan(9);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
INSERT INTO public.students(id,first_name,last_name,email) VALUES
 ('fa250400-0000-4000-8000-000000000001','Same','Person','merge-source@example.test'),
 ('fa250400-0000-4000-8000-000000000002','Same','Person','merge-retained@example.test'),
 ('fa250400-0000-4000-8000-000000000003','Retired','Person','released@example.test');
SELECT public.email_apply_sync_page('lifecycle-inbox',NULL,'lifecycle-1',true,'[
 {"id":"merge-mail-one","threadId":"merge-thread-one","sender":"merge-source@example.test","bodyText":"First history","receivedAt":"2026-10-01T00:00:00Z","draft":false},
 {"id":"merge-mail-two","threadId":"merge-thread-two","sender":"merge-source@example.test","bodyText":"Second history","receivedAt":"2026-10-02T00:00:00Z","draft":false},
 {"id":"retired-mail","threadId":"retired-thread","sender":"released@example.test","bodyText":"Original person history","receivedAt":"2026-10-03T00:00:00Z","draft":false}
]','{}');
SELECT public.email_link_record('merge-thread-one','student','fa250400-0000-4000-8000-000000000002');
SELECT public.email_link_participant('merge-thread-one','merge-source@example.test','student','fa250400-0000-4000-8000-000000000001');
SELECT public.email_link_participant('retired-thread','released@example.test','student','fa250400-0000-4000-8000-000000000003');
CREATE TEMP TABLE lifecycle_operation AS SELECT public.email_operational_prepare('lifecycle/merge','{"to":["recipient@example.test"],"email":{"subject":"Confirmation"}}','[{"type":"student","id":"fa250400-0000-4000-8000-000000000001"}]',NULL) AS value;
SELECT public.email_operational_update((SELECT (value->>'id')::uuid FROM lifecycle_operation),(SELECT (value->>'token')::uuid FROM lifecycle_operation),'creating','ready','lifecycle-provider-draft');
SELECT public.merge_students('fa250400-0000-4000-8000-000000000002','fa250400-0000-4000-8000-000000000001',public.preview_student_merge('fa250400-0000-4000-8000-000000000002','fa250400-0000-4000-8000-000000000001')->>'fingerprint','{"confirmed_same_person":true,"reviewed_parent_access":true,"login_user_id":null,"billing_student_id":null,"fields":{"email":"retained"}}');
SELECT is((SELECT count(*) FROM public.email_correspondence_for_record('student','fa250400-0000-4000-8000-000000000002')),2::bigint,'Student merge preserves all source email history on the retained Student');
SELECT is(jsonb_array_length(public.email_thread_detail('merge-thread-one')->'links'),1,'Student merge deduplicates source and retained email context');
SELECT is(public.email_thread_detail('merge-thread-one')->'links'->0->>'source','explicit','merge preserves explicit context over direct address inference');
SELECT public.email_apply_sync_page('lifecycle-inbox','lifecycle-1','lifecycle-2',true,'[{"id":"after-merge-mail","threadId":"after-merge-thread","sender":"merge-source@example.test","receivedAt":"2026-10-04T00:00:00Z","draft":false}]','{}');
SELECT is(public.email_thread_detail('after-merge-thread')->'links'->0->>'recordId','fa250400-0000-4000-8000-000000000002','reviewed email aliases follow the retained Student identity');
SELECT is(public.email_operational_prepare('lifecycle/merge','{"to":["recipient@example.test"],"email":{"subject":"Confirmation"}}','[{"type":"student","id":"fa250400-0000-4000-8000-000000000001"}]',NULL)->>'id',(SELECT value->>'id' FROM lifecycle_operation),'a retry with the original pre-merge context retains its operational delivery identity');
SELECT public.email_apply_sync_page('lifecycle-sent',NULL,'lifecycle-sent-1',true,'[{"id":"lifecycle-provider-draft","threadId":"lifecycle-op-thread","sender":"admin@altitutor.com","sentAt":"2026-10-05T00:00:00Z","draft":false}]','{}');
SELECT is(public.email_thread_detail('lifecycle-op-thread')->'links'->0->>'recordId','fa250400-0000-4000-8000-000000000002','an outstanding operational send reconciles onto the retained Student');
SELECT public.retire_student('fa250400-0000-4000-8000-000000000003');
SELECT is(public.email_thread_detail('retired-thread')->'links'->0->>'recordId','fa250400-0000-4000-8000-000000000003','Student deletion preserves original historical correspondence links');
INSERT INTO public.students(id,first_name,last_name,email) VALUES('fa250400-0000-4000-8000-000000000004','New','Person','released@example.test');
SELECT public.email_apply_sync_page('lifecycle-inbox','lifecycle-2','lifecycle-3',true,'[{"id":"new-owner-mail","threadId":"new-owner-thread","sender":"released@example.test","receivedAt":"2026-10-06T00:00:00Z","draft":false}]','{}');
SELECT is(public.email_thread_detail('new-owner-thread')->'links'->0->>'recordId','fa250400-0000-4000-8000-000000000004','a released address can belong to a new person without an obsolete alias overriding them');
SELECT is((SELECT count(*) FROM public.email_correspondence_for_record('student','fa250400-0000-4000-8000-000000000004')),1::bigint,'the new person does not inherit the retired Student history');
SELECT * FROM finish();
ROLLBACK;
