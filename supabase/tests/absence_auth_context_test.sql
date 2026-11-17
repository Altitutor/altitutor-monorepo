BEGIN;
SELECT no_plan();
INSERT INTO public.staff_subjects(staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', id
FROM public.subjects WHERE name = 'Medicine Interview' ON CONFLICT DO NOTHING;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
SELECT ok((public.log_student_absences('[]'::jsonb,
 '00000000-0000-0000-0000-000000000001')->>'success')::boolean,
 'public absence operation succeeds');
SELECT is(nullif(current_setting('request.jwt.claim.sub', true), ''), NULL::text,
 'absence operation restores the caller identity context');
SELECT set_config('request.jwt.claims',
 '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000010'::uuid,
 'the next caller resolves to the interview tutor');
SELECT ok((SELECT has_access FROM public.vtutor_interview_access),
 'authorised tutor retains interview access after another actor logs an absence');
RESET ROLE;
-- All public entry points must preserve an existing caller identity, including
-- JSON validation failures after the explicit actor has been installed.
CREATE FUNCTION pg_temp.check_absence_context() RETURNS SETOF text
LANGUAGE plpgsql AS $$
DECLARE
  function_name text;
  actor_id uuid;
  response jsonb;
BEGIN
  FOREACH function_name IN ARRAY ARRAY['log_staff_absences', 'undo_staff_absences',
    'log_student_absences', 'undo_student_absences', 'log_student_absences_self']
  LOOP
    actor_id := CASE WHEN function_name = 'log_student_absences_self'
      THEN '10000000-0000-0000-0000-000000000001'::uuid
      ELSE '00000000-0000-0000-0000-000000000001'::uuid END;
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
    EXECUTE format('SELECT public.%I($1,$2)', function_name) INTO response USING '[]'::jsonb, actor_id;
    RETURN NEXT ok((response->>'success')::boolean, function_name || ' succeeds');
    RETURN NEXT is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000002'::uuid,
      function_name || ' restores an existing caller');
    EXECUTE format('SELECT public.%I($1,$2)', function_name) INTO response
      USING '[{"action":"invalid"}]'::jsonb, actor_id;
    RETURN NEXT ok(NOT (response->>'success')::boolean, function_name || ' rejects invalid operations');
    RETURN NEXT is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000002'::uuid,
      function_name || ' restores the caller on a rejected operation');
  END LOOP;
END;
$$;
SELECT * FROM pg_temp.check_absence_context();
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000011","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT ok(NOT (SELECT has_access FROM public.vtutor_interview_access), 'tutor without Medicine Interview remains denied');
RESET ROLE;
SELECT ok(NOT has_function_privilege('authenticated', 'private.run_absence_lifecycle_operation(text,text,jsonb,uuid)', 'EXECUTE'), 'private dispatcher remains inaccessible');
RESET ROLE;
-- An actual row change must keep attribution on the explicit command actor,
-- even when the surrounding transaction belongs to a different administrator.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
SELECT ok((public.log_student_absences(
 (SELECT jsonb_agg(jsonb_build_object('student_id', student_id,
   'original_sessions_students_id', id, 'action', 'credit'))
  FROM public.sessions_students
  WHERE session_id = '50000000-0000-0000-0000-000000000005'
    AND student_id = '10000000-0000-0000-0000-000000000001'),
 '00000000-0000-0000-0000-000000000001')->>'success')::boolean,
 'real student credit command succeeds');
SELECT is((SELECT actor_staff_id FROM public.domain_events
 WHERE event_name = 'session.student_credited' AND recorded_at >= transaction_timestamp()
 ORDER BY recorded_at DESC LIMIT 1), '00000000-0000-0000-0000-000000000001'::uuid,
 'activity records the explicit absence actor');
SELECT is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000002'::uuid,
 'real row changes restore the surrounding caller');
CREATE FUNCTION pg_temp.check_absence_exception() RETURNS text LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    PERFORM public.log_student_absences(
      '[{"student_id":"invalid-uuid","action":"credit"}]'::jsonb,
      '00000000-0000-0000-0000-000000000001');
  EXCEPTION WHEN invalid_text_representation THEN
    NULL;
  END;
  RETURN is((SELECT auth.uid()), '00000000-0000-0000-0000-000000000002'::uuid,
    'SQL conversion failure restores the caller');
END;
$$;
SELECT pg_temp.check_absence_exception();
SELECT * FROM finish();
ROLLBACK;
