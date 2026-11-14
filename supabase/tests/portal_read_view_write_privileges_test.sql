BEGIN;
SELECT no_plan();
INSERT INTO public.notifications(id, student_id, staff_id, notification_type, app_scope, title)
VALUES
 ('fa442000-0000-4000-8000-000000000001', '10000000-0000-0000-0000-000000000001', NULL, 'facade_test', 'student_web', 'Student fixture'),
 ('fa442000-0000-4000-8000-000000000002', NULL, '00000000-0000-0000-0000-000000000010', 'facade_test', 'staff_web', 'Tutor fixture');
CREATE TEMP TABLE read_views(name text);
INSERT INTO read_views VALUES ('vstudent_notifications'),
('vstudent_session_files'),
('vstudent_slot_reservations'),
('vstudent_ucat_attempt_reviews'),
('vstudent_ucat_free_quota_reset_entitlements'),
('vstudent_ucat_my_activity_start'),
('vstudent_ucat_next_steps'),
('vstudent_ucat_question_stem_categories'),
('vstudent_ucat_score_projection_settings'),
('vstudent_ucat_sections'),
('vstudent_ucat_study_plan_generations'),
('vstudent_ucat_study_plan_tasks'),
('vtutor_blockouts'),
('vtutor_files'),
('vtutor_notes'),
('vtutor_notifications'),
('vtutor_session_files'),
('vtutor_ucat_ai_generation_model_profiles'),
('vtutor_ucat_ai_generation_prompt_layers'),
('vtutor_ucat_ai_generation_providers'),
('vtutor_ucat_ai_generation_runs'),
('vtutor_ucat_ai_generation_settings'),
('vtutor_ucat_ai_generation_system_prompts'),
('vtutor_ucat_ai_question_assessment_cycles'),
('vtutor_ucat_ai_question_assessment_decisions'),
('vtutor_ucat_ai_question_assessment_runs'),
('vtutor_ucat_learning_module_question_stem_categories'),
('vtutor_ucat_learning_module_question_tags'),
('vtutor_ucat_mock_detail'),
('vtutor_ucat_question_stem_categories'),
('vtutor_ucat_question_tags'),
('vtutor_ucat_sections'),
('vtutor_ucat_sessions_resources'),
('vtutor_ucat_skill_trainer_config'),
('vtutor_ucat_student_progress_summary');
GRANT SELECT ON read_views TO authenticated;
-- Execute every operation, rather than infer write access from updatability metadata.
CREATE FUNCTION pg_temp.dml_denied(view_name text, operation text) RETURNS boolean
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE col text;
BEGIN
 SELECT column_name INTO col FROM information_schema.columns WHERE table_schema='public' AND table_name=view_name AND is_updatable='YES' ORDER BY ordinal_position LIMIT 1;
 IF operation='INSERT' THEN EXECUTE format('INSERT INTO public.%I (%I) SELECT %I FROM public.%I WHERE false', view_name,col,col,view_name);
 ELSIF operation='UPDATE' THEN EXECUTE format('UPDATE public.%I SET %I=%I WHERE false',view_name,col,col);
 ELSE EXECUTE format('DELETE FROM public.%I WHERE false',view_name); END IF;
 RETURN false;
EXCEPTION WHEN insufficient_privilege THEN RETURN true;
END $$;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT title FROM public.vstudent_notifications WHERE id='fa442000-0000-4000-8000-000000000001'),
 'Student fixture', 'Student reads its actual notification');
SELECT ok(pg_temp.dml_denied(name,op), name || ' denies ' || op) FROM read_views CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE')) ops(op);
RESET ROLE;

SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000010',true);
SET LOCAL ROLE authenticated;
SELECT ok(pg_temp.dml_denied(name,op), 'Tutor: ' || name || ' denies ' || op)
FROM read_views CROSS JOIN (VALUES ('INSERT'),('UPDATE'),('DELETE')) ops(op);
SELECT is((SELECT title FROM public.vtutor_notifications WHERE id='fa442000-0000-4000-8000-000000000002'),
 'Tutor fixture', 'Tutor reads its actual notification');
SELECT lives_ok(format('SELECT * FROM public.%I LIMIT 1',name), 'Tutor can query ' || name) FROM read_views;
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','10000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok(format('SELECT * FROM public.%I LIMIT 1',name), 'Student can query ' || name) FROM read_views;
RESET ROLE;
SET LOCAL ROLE service_role;
SELECT lives_ok($$UPDATE public.notifications SET title='Service update' WHERE id='fa442000-0000-4000-8000-000000000001'$$,
 'Service route client can update notification base table');
SELECT is((SELECT title FROM public.notifications WHERE id='fa442000-0000-4000-8000-000000000001'),
 'Service update', 'Service route update persists');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT lives_ok($$UPDATE public.notifications SET title='Staff update' WHERE id='fa442000-0000-4000-8000-000000000002'$$,
 'AdminStaff can update notification base table');
SELECT is((SELECT title FROM public.notifications WHERE id='fa442000-0000-4000-8000-000000000002'),
 'Staff update', 'AdminStaff update persists');
RESET ROLE;
SELECT * FROM finish();
ROLLBACK;
