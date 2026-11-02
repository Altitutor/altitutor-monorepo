BEGIN;
SELECT plan(33);
INSERT INTO public.staff(id,first_name,last_name,role,status) VALUES('fa250000-0000-4000-8000-000000000001','Email','Admin','ADMINSTAFF','ACTIVE');
SET LOCAL ROLE service_role;
SELECT set_config('request.jwt.claims','{"role":"service_role"}',true);
SELECT public.email_apply_sync_page('inbox', NULL, 'page-1', false,
  '[{"id":"mail-one","threadId":"mail-thread","folderId":"inbox","read":false,"draft":false,"subject":"Class change","bodyText":"Could we change classes?","sender":"parent@example.test","to":["admin@altitutor.com"],"receivedAt":"2026-10-01T00:00:00Z"}]', '{}');
SELECT is(public.email_thread_detail('mail-thread')->'messages'->0->>'subject', 'Class change', 'a synced message is readable through its thread');
SELECT ok(public.email_apply_sync_page('inbox',NULL,NULL,false,'[{"id":"observed-command","threadId":"observed-thread","read":true,"subject":"Command observation"}]','{}',true),'a confirmed mailbox command can update the same cache without a delta cursor');
SELECT is(public.email_thread_detail('observed-thread')->'messages'->0->>'read','true','command results are readable immediately through the shared thread interface');
SELECT public.email_apply_sync_page('inbox', 'page-1', 'page-2', true,
  '[{"id":"mail-one","read":true}]', '{}');
SELECT is(public.email_thread_detail('mail-thread')->'messages'->0->>'bodyText', 'Could we change classes?', 'partial read updates preserve the cached body and thread');
SELECT public.email_assign_thread('mail-thread','fa250000-0000-4000-8000-000000000001');
SELECT is(public.email_thread_detail('mail-thread')->>'assignedStaffId','fa250000-0000-4000-8000-000000000001','a read email can be assigned independently of read state');
SELECT public.email_apply_sync_page('inbox','page-2','page-3',true,'[{"id":"mail-one","read":false}]','{}');
SELECT is(public.email_thread_detail('mail-thread')->>'assignedStaffId','fa250000-0000-4000-8000-000000000001','changing read state does not clear responsibility');
SELECT public.email_apply_sync_page('inbox','page-3','page-4',true,
 jsonb_build_array(jsonb_build_object('id','followup','threadId','mail-thread','folderId','inbox','sender','parent@example.test','receivedAt',now()+interval '1 second','draft',false)), '{}');
SELECT is(public.email_thread_detail('mail-thread')->>'assignedStaffId','fa250000-0000-4000-8000-000000000001','an incoming follow-up retains responsibility');
SELECT is((SELECT count(*) FROM public.notifications WHERE notification_type='EMAIL_FOLLOWUP' AND metadata->>'email_thread_id'='mail-thread'),1::bigint,'an incoming follow-up notifies the assignee once');
SELECT public.email_apply_sync_page('sent',NULL,'sent-1',true,
 jsonb_build_array(jsonb_build_object('id','staff-reply','threadId','mail-thread','folderId','sent','sender','admin@altitutor.com','sentAt',now()+interval '2 seconds','draft',false)), '{}');
SELECT is(public.email_thread_detail('mail-thread')->>'assignedStaffId',NULL,'a staff reply observed from Outlook clears responsibility');
SELECT public.email_apply_sync_page('inbox','page-4','page-5',true,
 jsonb_build_array(jsonb_build_object('id','later-incoming','threadId','mail-thread','folderId','inbox','sender','parent@example.test','receivedAt',now()+interval '3 seconds','draft',false)), '{}');
SELECT is(public.email_thread_detail('mail-thread')->>'assignedStaffId',NULL,'a later incoming message stays unassigned');
INSERT INTO public.onboarding_emails(id,subject,body_text,sender,recipients,occurred_at,direction,ignored)
 VALUES('historical-review','Original','Original body','parent@example.test','{admin@altitutor.com}',now(),'inbound',true);
SELECT public.email_apply_sync_page('inbox','page-5','page-6',true,
 '[{"id":"historical-review","threadId":"review-thread","subject":"Updated subject","bodyText":"New body","sender":"parent@example.test","to":["admin@altitutor.com"],"receivedAt":"2026-10-01T00:00:00Z","draft":false}]','{}');
SELECT is((SELECT subject FROM public.onboarding_emails WHERE id='historical-review'),'Updated subject','unified sync maintains readable onboarding history');
SELECT ok((SELECT ignored FROM public.onboarding_emails WHERE id='historical-review'),'sync preserves the independent enquiry review decision');
SELECT public.email_apply_sync_page('drafts',NULL,'draft-1',true,
 '[{"id":"unsent","threadId":"review-thread","subject":"Not sent","sender":"admin@altitutor.com","to":["parent@example.test"],"sentAt":"2026-10-01T00:00:00Z","draft":true}]','{}');
SELECT is((SELECT count(*) FROM public.onboarding_emails WHERE id='unsent'),0::bigint,'unsent drafts cannot become successful onboarding communication evidence');
RESET ROLE;
INSERT INTO public.parents(id,first_name,last_name,email) VALUES('fa250000-0000-4000-8000-000000000002','Direct','Parent','direct-parent@example.test');
INSERT INTO public.students(id,first_name,last_name,email,status) VALUES('fa250000-0000-4000-8000-000000000003','Explicit','Child','child@example.test','TRIAL');
INSERT INTO public.parents_students(parent_id,student_id) VALUES('fa250000-0000-4000-8000-000000000002','fa250000-0000-4000-8000-000000000003');
SET LOCAL ROLE service_role;
SELECT public.email_apply_sync_page('inbox','page-6','page-7',true,
 '[{"id":"direct-mail","threadId":"direct-thread","sender":"direct-parent@example.test","to":["admin@altitutor.com"],"receivedAt":"2026-10-01T00:00:00Z","draft":false}]','{}');
SELECT is(public.email_thread_detail('direct-thread')->'links'->0->>'recordType','parent','a unique direct participant links to their own record');
SELECT is(jsonb_array_length(public.email_thread_detail('direct-thread')->'links'),1,'a parent email does not roll onto their child automatically');
INSERT INTO public.onboarding_journeys(id,student_id,label,historical) VALUES('fa250000-0000-4000-8000-000000000020','fa250000-0000-4000-8000-000000000003','Child journey',true);
SELECT is((SELECT count(*) FROM public.onboarding_emails_for_journey('fa250000-0000-4000-8000-000000000020')),0::bigint,'parent correspondence is not inferred onto every child journey');
SELECT public.email_link_record('direct-thread','student','fa250000-0000-4000-8000-000000000003');
SELECT is(jsonb_array_length(public.email_thread_detail('direct-thread')->'links'),2,'staff can add explicit child context');
SELECT is((SELECT count(*) FROM public.onboarding_emails_for_journey('fa250000-0000-4000-8000-000000000020')),1::bigint,'explicit child context makes the same message visible in the journey');
SELECT is((SELECT count(*) FROM public.email_correspondence_for_record('student','fa250000-0000-4000-8000-000000000003')),1::bigint,'the Student Activity correspondence source uses the same explicit email context');
SELECT public.email_apply_sync_page('drafts','draft-1','draft-2',true,
 '[{"id":"send-once","threadId":"send-thread","draft":true,"changeKey":"version-1","bodyText":"Preserved draft"}]','{}');
SELECT is(public.email_begin_send('send-once','version-1','fa250000-0000-4000-8000-000000000001','fa250000-0000-4000-8000-000000000010')->>'proceed','true','a durable send attempt is claimed before contacting Microsoft');
SELECT is(public.email_begin_send('send-once','version-1','fa250000-0000-4000-8000-000000000001','fa250000-0000-4000-8000-000000000011')->>'proceed','false','another request cannot resubmit an unresolved send');
SELECT is(jsonb_array_length(public.email_list_threads('inbox','Class change','all',0,50)->'threads'),1,'mail search returns one conversation even when the thread has multiple messages');
INSERT INTO public.staff(id,first_name,last_name,role,status) VALUES('fa250000-0000-4000-8000-000000000004','Other','Admin','ADMINSTAFF','ACTIVE');
SELECT public.email_apply_sync_page('sent','sent-1','sent-2',true,jsonb_build_array(jsonb_build_object('id','send-once','threadId','send-thread','draft',false,'sender','admin@altitutor.com','sentAt',now()+interval '5 seconds')),'{}');
SELECT is((SELECT state FROM public.email_send_attempts WHERE message_id='send-once'),'sent','the same immutable draft observed as sent reconciles an unresolved portal send');
SELECT public.email_apply_sync_page('drafts','draft-2','draft-3',true,
 '[{"id":"edit-draft","threadId":"edit-thread","draft":true,"changeKey":"version-1","bodyText":"Shared work"}]','{}');
SELECT is(public.email_claim_draft('edit-draft','version-1','fa250000-0000-4000-8000-000000000001','fa250000-0000-4000-8000-000000000031')->>'state','ready','an admin can claim a shared draft edit');
SELECT is(public.email_claim_draft('edit-draft','version-1','fa250000-0000-4000-8000-000000000004','fa250000-0000-4000-8000-000000000032')->>'state','busy','another portal editor cannot overwrite an active edit');
SELECT is(public.email_begin_send('edit-draft','version-1','fa250000-0000-4000-8000-000000000004','fa250000-0000-4000-8000-000000000033')->>'proceed','false','another portal user cannot submit a draft being edited');
SELECT public.email_apply_sync_page('inbox','page-7','page-8',true,'[{"id":"other-address-in-thread","threadId":"direct-thread","sender":"other-address@example.test","receivedAt":"2026-10-01T00:00:00Z"}]','{}');
SELECT public.email_link_participant('direct-thread','other-address@example.test','parent','fa250000-0000-4000-8000-000000000002');
SELECT public.email_apply_sync_page('inbox','page-8','page-9',true,
 '[{"id":"known-address-mail","threadId":"known-address-thread","sender":"other-address@example.test","to":["admin@altitutor.com"],"receivedAt":"2026-10-01T00:00:00Z","draft":false}]','{}');
SELECT is(public.email_thread_detail('known-address-thread')->'links'->0->>'recordId','fa250000-0000-4000-8000-000000000002','a reviewed email identity links future correspondence without changing the profile or messaging handle');
SELECT is(public.email_create_enquiry('historical-review','{"label":"Confirmed enquiry","enquiry_email":"parent@example.test","historical":false,"enquiry_at":"2026-10-29T00:00:00Z"}'),public.email_create_enquiry('historical-review','{"label":"Confirmed enquiry","enquiry_email":"parent@example.test","historical":false,"enquiry_at":"2026-10-29T00:00:00Z"}'),'confirming the same email enquiry is atomic and duplicate-safe');
SELECT public.email_reset_sync_cursor('inbox','page-9');
SELECT public.email_apply_sync_page('inbox',NULL,'reset-first',true,
 '[{"id":"known-address-mail","threadId":"known-address-thread","sender":"other-address@example.test","receivedAt":"2026-10-01T00:00:00Z"}]','{}');
SELECT is(jsonb_array_length(public.email_list_threads('inbox','Class change','all',0,50)->'threads'),0,'a completed fresh bootstrap removes stale cached folder membership');
SELECT public.email_apply_sync_page('inbox','reset-first','sort-page',true,
 '[{"id":"sort-alpha","threadId":"sort-alpha-thread","sender":"alpha@example.test","subject":"Sort contract","receivedAt":"2026-10-01T00:00:00Z"},{"id":"sort-zulu","threadId":"sort-zulu-thread","sender":"zulu@example.test","subject":"Sort contract","receivedAt":"2026-10-02T00:00:00Z"}]','{}');
SELECT is(public.email_list_threads('inbox','Sort contract','all',0,50,'sender','asc')->'threads'->0->>'sender','alpha@example.test','Display sender sorting is applied before pagination');
SELECT is(public.email_list_threads('inbox','Sort contract','all',0,50,'received','asc')->'threads'->0->>'id','sort-alpha-thread','Display received ascending sorting is applied before pagination');
SELECT set_config('request.jwt.claims','{"role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is(public.email_thread_detail('direct-thread'),NULL::jsonb,'non-admin users cannot read cached shared email');
SELECT throws_ok($$SELECT public.email_assign_thread('direct-thread','fa250000-0000-4000-8000-000000000001')$$,'42501','Active adminstaff required','non-admin users cannot assign shared email through a definer RPC');
SELECT * FROM finish();
ROLLBACK;
