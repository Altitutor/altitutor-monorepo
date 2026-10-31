BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;
SET LOCAL search_path=public,extensions;
SELECT no_plan();
CREATE TEMP TABLE retention_fixtures(kind text,tab text,id uuid);
INSERT INTO retention_fixtures VALUES
 ('staff','staff','fd276000-0000-4000-8000-000000000011'),('parent','parents','fd276000-0000-4000-8000-000000000012'),
 ('class','classes','fd276000-0000-4000-8000-000000000013'),('subject','subjects','fd276000-0000-4000-8000-000000000014'),
 ('topic','topics','fd276000-0000-4000-8000-000000000015'),('task','tasks','fd276000-0000-4000-8000-000000000016'),
 ('project','projects','fd276000-0000-4000-8000-000000000017'),('issue','issues','fd276000-0000-4000-8000-000000000018'),
 ('document','notes_documents','fd276000-0000-4000-8000-000000000019'),('folder','notes_folders','fd276000-0000-4000-8000-000000000020'),
 ('admin_shift','admin_shifts','fd276000-0000-4000-8000-000000000021'),
 ('session','sessions','fd276000-0000-4000-8000-000000000031'),('tutor_log','tutor_logs','fd276000-0000-4000-8000-000000000032');
GRANT SELECT ON retention_fixtures TO authenticated;
CREATE TEMP TABLE retention_edit_token(token uuid);
GRANT SELECT,INSERT ON retention_edit_token TO authenticated;
INSERT INTO public.staff(id,first_name,last_name,role,status,user_id,email,phone_number) VALUES('fd276000-0000-4000-8000-000000000011','Retained','Staff','TUTOR','INACTIVE','10000000-0000-0000-0000-000000000001','retention-staff@altitutor.test','+61400199275');
INSERT INTO public.parents(id,first_name,last_name,user_id,email,phone) VALUES('fd276000-0000-4000-8000-000000000012','Retained','Parent','00000000-0000-0000-0000-000000000010','retention-parent@altitutor.test','+61400199276');
INSERT INTO public.parents_students(parent_id,student_id) VALUES('fd276000-0000-4000-8000-000000000012','10000000-0000-0000-0000-000000000001');
INSERT INTO public.classes(id,day_of_week,start_time,end_time,status,session_start_date,session_end_date,session_type,billing_type) VALUES('fd276000-0000-4000-8000-000000000013',1,'10:00','11:00','INACTIVE',current_date-30,current_date-1,'HOMEWORK_HELP',NULL);
INSERT INTO public.sessions(id,class_id,start_at,end_at,type,status) VALUES('fd276000-0000-4000-8000-000000000023','fd276000-0000-4000-8000-000000000013',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','HOMEWORK_HELP','ACTIVE');
INSERT INTO public.subjects(id,name) VALUES('fd276000-0000-4000-8000-000000000014','Retained subject'),('fd276000-0000-4000-8000-000000000024','Topic owner');
INSERT INTO public.topics(id,subject_id,name,"index",code) VALUES('fd276000-0000-4000-8000-000000000015','fd276000-0000-4000-8000-000000000024','Retained topic',1,'RET276');
INSERT INTO public.tasks(id,title,status) VALUES('fd276000-0000-4000-8000-000000000016','Retained task','todo');
INSERT INTO public.tasks(id,title,status) VALUES('fd276000-0000-4000-8000-000000000026','Active work','in_progress');
INSERT INTO public.projects(id,name,status) VALUES('fd276000-0000-4000-8000-000000000017','Retained project','backlog');
INSERT INTO public.issues(id,name) VALUES('fd276000-0000-4000-8000-000000000018','Retained issue');
INSERT INTO public.notes_documents(id,title,created_by) VALUES('fd276000-0000-4000-8000-000000000019','Retained document','00000000-0000-0000-0000-000000000001');
INSERT INTO public.notes_folders(id,name,created_by) VALUES('fd276000-0000-4000-8000-000000000020','Retained folder','00000000-0000-0000-0000-000000000001');
INSERT INTO public.admin_shifts(id,day_of_week,start_time,end_time,status,session_start_date,session_end_date) VALUES('fd276000-0000-4000-8000-000000000021',1,'10:00','11:00','INACTIVE',current_date-30,current_date-1);
INSERT INTO public.sessions(id,start_at,end_at,type,status) VALUES('fd276000-0000-4000-8000-000000000031',now()-interval '2 days',now()-interval '2 days'+interval '1 hour','HOMEWORK_HELP','ACTIVE');
INSERT INTO public.sessions_staff(session_id,staff_id) VALUES('fd276000-0000-4000-8000-000000000031','00000000-0000-0000-0000-000000000001'),('fd276000-0000-4000-8000-000000000031','00000000-0000-0000-0000-000000000010');
INSERT INTO public.tutor_logs(id,session_id,session_type,created_by,logged_for_staff_id) VALUES('fd276000-0000-4000-8000-000000000032','fd276000-0000-4000-8000-000000000031','HOMEWORK_HELP','00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001');
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(format('SELECT public.retire_business_record(%L,%L)',kind,id),'AdminStaff deletes '||kind) FROM retention_fixtures;
SELECT is((SELECT count(*) FROM public.deleted_business_records() d WHERE d.kind=f.kind AND d.id=f.id),1::bigint,'deleted '||f.kind||' is discoverable') FROM retention_fixtures f;
SELECT is((SELECT count(*) FROM public.parents WHERE id='fd276000-0000-4000-8000-000000000012'),0::bigint,'deleted Parent is absent from ordinary reads');
SELECT throws_ok($$INSERT INTO public.parents_students(parent_id,student_id) VALUES('fd276000-0000-4000-8000-000000000012','10000000-0000-0000-0000-000000000002')$$,'23514','Restore the deleted parents record before linking new activity','new relationships cannot target a deleted Parent');
SELECT throws_ok($$SELECT public.admin_work_item_read('task','fd276000-0000-4000-8000-000000000016')$$,'P0002','Work item not found','work-item read cannot reopen a deleted Task');
-- Test ordinary RPC directories, not merely RLS on base-table reads.
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_parents_admin(p_limit=>1000)->'parents') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000012'),0::bigint,'Parent search hides tombstones');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_staff_admin(p_statuses=>NULL,p_limit=>1000)->'staff') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000011'),0::bigint,'Staff search hides tombstones even when inactive is included');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_classes_admin(p_statuses=>NULL,p_limit=>1000)->'classes') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000013'),0::bigint,'Class search hides tombstones');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_subjects_admin(p_limit=>1000)->'subjects') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000014'),0::bigint,'Subject search hides tombstones');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_topics_admin(p_limit=>1000)->'topics') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000015'),0::bigint,'Topic search hides tombstones');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_sessions_admin(p_limit=>1000)->'sessions') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000031'),0::bigint,'Session search hides tombstones');
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_tutor_logs_admin(p_limit=>1000)->'tutor_logs') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000032'),0::bigint,'Tutor-log search hides tombstones');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT throws_ok($$SELECT public.search_subjects_public(p_limit=>1000)$$,'42501','permission denied for function search_subjects_public','anonymous callers retain the existing denied directory access');
RESET ROLE;
SELECT is((SELECT count(*) FROM jsonb_array_elements(public.search_subjects_public(p_limit=>1000)->'subjects') item WHERE item->>'id'='fd276000-0000-4000-8000-000000000014'),0::bigint,'public trial-booking Subject search hides tombstones');
RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT ok((SELECT deleted_at IS NOT NULL FROM public.vadmin_session_log_state WHERE session_id='fd276000-0000-4000-8000-000000000031'),'Admin logging availability marks the retained log as restore-required');
SELECT lives_ok(format('SELECT public.restore_business_record(%L,%L)',kind,id),'AdminStaff restores '||kind) FROM retention_fixtures;
SELECT is((SELECT count(*) FROM public.deleted_business_records() d WHERE d.kind=f.kind AND d.id=f.id),0::bigint,'restored '||f.kind||' leaves deleted directory') FROM retention_fixtures f;
SELECT ok((SELECT user_id IS NULL AND email IS NULL AND phone_number IS NULL AND status='INACTIVE' FROM public.staff WHERE id='fd276000-0000-4000-8000-000000000011'),'Staff restoration does not reclaim contacts, login or access');
SELECT ok((SELECT user_id IS NULL AND email IS NULL AND phone IS NULL FROM public.parents WHERE id='fd276000-0000-4000-8000-000000000012'),'Parent restoration does not reclaim contacts or login');
SELECT is((SELECT count(*) FROM public.parents_students WHERE parent_id='fd276000-0000-4000-8000-000000000012'),1::bigint,'Parent Student relationships remain after restore');
SELECT is((SELECT count(*) FROM public.sessions WHERE id='fd276000-0000-4000-8000-000000000023'),1::bigint,'historical Class Sessions survive deletion and restoration');
SELECT throws_ok($$SELECT public.retire_business_record('task','fd276000-0000-4000-8000-000000000026')$$,'P0001','Resolve active work before deleting this Task','active Task work must be resolved');
INSERT INTO retention_edit_token SELECT (public.admin_work_item_edit('task','fd276000-0000-4000-8000-000000000016','acquire')->>'token')::uuid;
SELECT throws_ok($$SELECT public.retire_business_record('task','fd276000-0000-4000-8000-000000000016')$$,'55P03','This record is being edited. Close its editor first.','directory deletion cannot bypass an active editor');
SELECT throws_ok($$DELETE FROM public.tasks WHERE id='fd276000-0000-4000-8000-000000000016'$$,'55P03','A valid editing session is required','direct table deletion cannot bypass the editing lease');
SELECT lives_ok($$SELECT public.admin_work_item_edit('task','fd276000-0000-4000-8000-000000000016','delete',(SELECT token FROM retention_edit_token))$$,'existing editor Delete command performs retained deletion');
SELECT is((SELECT count(*) FROM public.deleted_business_records() WHERE kind='task' AND id='fd276000-0000-4000-8000-000000000016'),1::bigint,'editor-deleted Task appears in the directory');
SELECT lives_ok($$SELECT public.restore_business_record('task','fd276000-0000-4000-8000-000000000016')$$,'editor-deleted Task can be restored');
SELECT lives_ok($$SELECT public.retire_business_record('topic','fd276000-0000-4000-8000-000000000015')$$,'delete Topic before its Subject');
SELECT lives_ok($$SELECT public.retire_business_record('subject','fd276000-0000-4000-8000-000000000024')$$,'delete resolved Subject');
SELECT throws_ok($$SELECT public.restore_business_record('topic','fd276000-0000-4000-8000-000000000015')$$,'P0001','Restore the Subject first','restore cannot revive content beneath a deleted Subject');
SELECT lives_ok($$SELECT public.restore_business_record('subject','fd276000-0000-4000-8000-000000000024')$$,'restore Subject');
SELECT lives_ok($$SELECT public.restore_business_record('topic','fd276000-0000-4000-8000-000000000015')$$,'restore Topic after its Subject');
SELECT throws_ok($$SELECT public.retire_business_record('staff','00000000-0000-0000-0000-000000000001')$$,'P0001','You cannot delete your own Staff record','acting AdminStaff cannot delete their own access');
SELECT throws_ok($$SELECT public.retire_business_record('class','20000000-0000-0000-0000-000000000001')$$,'P0001','Make the Class inactive and resolve enrolments and future bookings before deletion','live Class cannot be deleted');
-- Existing direct DELETE must not run destructive side effects before guards.
INSERT INTO public.sessions(id,admin_shift_id,start_at,end_at,type,status) VALUES('fd276000-0000-4000-8000-000000000041','fd276000-0000-4000-8000-000000000021',now()+interval '1 hour',now()+interval '2 hours','ADMIN_SHIFT','ACTIVE');
SELECT throws_ok($$DELETE FROM public.admin_shifts WHERE id='fd276000-0000-4000-8000-000000000021'$$,'P0001','Make the Admin shift inactive and resolve future bookings before deletion','direct Admin-shift deletion cannot erase unresolved Sessions');
SELECT is((SELECT count(*) FROM public.sessions WHERE id='fd276000-0000-4000-8000-000000000041'),1::bigint,'blocked Admin-shift deletion preserves its future Session');
SELECT throws_ok($$DELETE FROM public.sessions WHERE id='fd276000-0000-4000-8000-000000000041'$$,'P0001','Resolve the active Session before deletion','unresolved Session deletion is rejected');
INSERT INTO public.sessions(id,start_at,end_at,type,status) VALUES('fd276000-0000-4000-8000-000000000042',now()-interval '10 minutes',now()+interval '50 minutes','HOMEWORK_HELP','ACTIVE');
INSERT INTO public.sessions_parents(session_id,parent_id) VALUES('fd276000-0000-4000-8000-000000000042','fd276000-0000-4000-8000-000000000012');
SELECT throws_ok($$SELECT public.retire_business_record('parent','fd276000-0000-4000-8000-000000000012')$$,'P0001','Resolve future Parent bookings before deletion','an in-progress Parent booking remains unresolved');
SELECT public.retire_business_record('tutor_log','fd276000-0000-4000-8000-000000000032');
RESET ROLE;
-- A shared login keeps its unrelated role, while the retired role stays detached.
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT ok((SELECT deleted_at IS NOT NULL FROM public.vtutor_session_log_state WHERE session_id='fd276000-0000-4000-8000-000000000031'),'assigned Tutor sees restore-required availability without deleted log content');
SELECT is((SELECT count(*) FROM public.vtutor_profile),1::bigint,'deleting a Parent preserves the shared Tutor login');
SELECT throws_ok($$SELECT public.retire_business_record('parent','fd276000-0000-4000-8000-000000000012')$$,'42501','Active AdminStaff access required','Tutor cannot retire a business record');
SELECT throws_ok($$SELECT public.restore_business_record('parent','fd276000-0000-4000-8000-000000000012')$$,'42501','Active AdminStaff access required','Tutor cannot restore a business record');
SELECT throws_ok($$SELECT public.purge_expired_class_session_tombstones()$$,'42501','Active AdminStaff access required','Tutor cannot invoke calendar maintenance');
SELECT throws_ok($$SELECT * FROM public.deleted_business_records()$$,'42501','Active AdminStaff access required','Tutor cannot read the deleted directory');
RESET ROLE;
SELECT set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT count(*) FROM public.vtutor_profile),0::bigint,'retired Staff role is not revived on restore');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
