BEGIN;
SELECT no_plan();
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}', true);
INSERT INTO public.sessions(id,type,start_at,end_at,status)
VALUES('fd170000-0000-4000-8000-000000000001','CHECK_IN',now()-interval '1 hour',now()-interval '15 minutes','ACTIVE');
INSERT INTO public.sessions_staff(session_id,staff_id,type)
VALUES('fd170000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000010','CHECK_IN_HOST');
CREATE TEMP TABLE identity_log AS SELECT public.create_tutor_log(
 p_session_id=>'fd170000-0000-4000-8000-000000000001',
 p_created_by=>'00000000-0000-0000-0000-000000000001',
 p_logged_for_staff_id=>'00000000-0000-0000-0000-000000000010') AS value;
SELECT is((SELECT value->>'success' FROM identity_log),'true','create tutor log succeeds');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'create tutor log restores the surrounding identity');
SELECT is((SELECT created_by FROM public.tutor_logs WHERE session_id='fd170000-0000-4000-8000-000000000001'),
 '00000000-0000-0000-0000-000000000001'::uuid,'tutor log retains the explicit submitter');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT is(public.update_tutor_log(
 p_tutor_log_id=>(SELECT (value->>'tutor_log_id')::uuid FROM identity_log),
 p_updated_by=>'00000000-0000-0000-0000-000000000001',
 p_logged_for_staff_id=>'00000000-0000-0000-0000-000000000010')->>'success','true','update tutor log succeeds');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'update tutor log restores the surrounding identity');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}', true);
SELECT public.get_student_ucat_study_plan_generation_bundle('10000000-0000-0000-0000-000000000010') IS NOT NULL AS bundle_returned;
SELECT is(current_setting('request.jwt.claims')::jsonb,
 '{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}'::jsonb,
 'student bundle restores all surrounding claims');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'student bundle restores the legacy identity');
INSERT INTO public.staff_subjects(staff_id,subject_id)
SELECT '00000000-0000-0000-0000-000000000010',id FROM public.subjects WHERE name='UCAT' ON CONFLICT DO NOTHING;
INSERT INTO public.ucat_ai_generation_runs(id,section_id,requested_stem_count,created_by)
VALUES('fd170000-0000-4000-8000-000000000010','8dfbf286-e952-4581-b065-255ead834628',1,'00000000-0000-0000-0000-000000000010');
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}',true);
CREATE TEMP TABLE identity_stem AS SELECT public.service_ucat_persist_generated_stem(
 'fd170000-0000-4000-8000-000000000010',0,
 '{"stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Identity test"}]}]},"questions":[]}'::jsonb) AS id;
SELECT ok((SELECT id IS NOT NULL FROM identity_stem),'background generation persists a real stem');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'background generation restores the caller');
SELECT is((SELECT created_by FROM public.question_stems WHERE id=(SELECT id FROM identity_stem)),
 '00000000-0000-0000-0000-000000000010'::uuid,'generated stem is attributed to the requested tutor');
INSERT INTO public.ucat_ai_question_assessment_cycles(id,stem_id,is_current)
SELECT 'fd170000-0000-4000-8000-000000000011',id,true FROM identity_stem;
INSERT INTO public.ucat_ai_question_assessment_runs(id,cycle_id,stem_id,trigger_kind,scope_type,dedupe_key,content_fingerprint,shared_fingerprint,content_snapshot,status,requested_by)
SELECT 'fd170000-0000-4000-8000-000000000012','fd170000-0000-4000-8000-000000000011',id,'retry','full','identity-restoration','identity','identity','{}','running','00000000-0000-0000-0000-000000000010' FROM identity_stem;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}',true);
SELECT is(public.service_ucat_apply_verified_assessment_repair(
 'fd170000-0000-4000-8000-000000000012',
 (SELECT updated_at FROM public.question_stems WHERE id=(SELECT id FROM identity_stem)), '{}',
 '{"sectionId":"8dfbf286-e952-4581-b065-255ead834628","stemText":{"type":"doc","content":[{"type":"paragraph","content":[{"type":"text","text":"Repaired identity test"}]}]},"questions":[]}',
 '[]','Identity test repair',NULL,'[]')->>'id',(SELECT id::text FROM identity_stem),'verified assessment repair succeeds');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'assessment repair restores the caller');
SELECT is(current_setting('request.jwt.claims')::jsonb,
 '{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role","custom":"preserve"}'::jsonb,'assessment repair restores all claims');
INSERT INTO public.ucat_student_preparation_section_states(student_id,test_year,section_id,learning_graduated_at,learning_graduation_route,policy_version)
VALUES('10000000-0000-0000-0000-000000000010',2026,'8dfbf286-e952-4581-b065-255ead834628',now(),'accuracy','identity-test')
ON CONFLICT(student_id,test_year,section_id) DO UPDATE SET policy_version=excluded.policy_version;
SELECT set_config('request.jwt.claim.sub','',true);
CREATE TEMP TABLE clean_identity_bundle AS SELECT public.get_student_ucat_study_plan_generation_bundle('10000000-0000-0000-0000-000000000010') AS value;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002","role":"service_role"}',true);
SELECT is(public.get_student_ucat_study_plan_generation_bundle('10000000-0000-0000-0000-000000000010'),
 (SELECT value FROM clean_identity_bundle),'student bundle ignores a legacy subject while reading the intended student');
SELECT is(jsonb_array_length(public.get_student_ucat_study_plan_generation_bundle('10000000-0000-0000-0000-000000000010')->'vstudent_ucat_preparation_section_states'),1,
 'student bundle includes the intended student graduation despite another legacy subject');
-- Caught data errors and early validation returns must not leave a new actor.
SELECT is(public.update_tutor_log(
 p_tutor_log_id=>(SELECT (value->>'tutor_log_id')::uuid FROM identity_log),
 p_updated_by=>'00000000-0000-0000-0000-000000000001',
 p_logged_for_staff_id=>'00000000-0000-0000-0000-000000000010',p_topics=>'{}'::jsonb)->>'success','false',
 'tutor-log update reports a caught malformed-payload error');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'caught tutor-log error restores the caller');
SELECT is(public.create_tutor_log('fd170000-0000-4000-8000-000000000099',
 '00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000010')->>'success','false','early validation failure remains rejected');
SELECT is((SELECT auth.uid()),'00000000-0000-0000-0000-000000000002'::uuid,'early validation failure preserves the caller');
SELECT ok(NOT has_function_privilege('authenticated','public.service_ucat_persist_generated_stem(uuid,integer,jsonb)','EXECUTE'), 'generation writer remains service-only');
SELECT ok(NOT has_function_privilege('authenticated','public.get_student_ucat_study_plan_generation_bundle(uuid)','EXECUTE'), 'cross-student bundle remains service-only');
SELECT * FROM finish();
ROLLBACK;
