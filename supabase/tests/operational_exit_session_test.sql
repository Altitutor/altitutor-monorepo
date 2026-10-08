BEGIN;
SELECT no_plan();
SELECT set_config('app.class_schedule_apply', 'true', true);
CREATE TEMP TABLE exit_fixture AS
SELECT scenario, expected,
  md5('operational-exit-' || scenario)::uuid AS id,
  forms.id AS form_id, forms.latest_published_version_id AS version_id, enrollment.id AS enrollment_id,
  enrollment.class_id
  , CASE scenario WHEN 'inactive' THEN interval '1 hour' WHEN 'tombstone' THEN interval '2 hours'
      WHEN 'expired-tombstone' THEN interval '3 hours' ELSE interval '0' END AS offset_at
FROM (VALUES ('active', true), ('inactive', false), ('tombstone', false),
  ('expired-tombstone', false)) cases(scenario, expected)
JOIN public.forms ON forms.workflow_key = 'student_unenrolment' AND forms.archived_at IS NULL
JOIN public.classes_students enrollment ON enrollment.student_id = '10000000-0000-0000-0000-000000000001'
  AND enrollment.class_id = '20000000-0000-0000-0000-000000000001';
SELECT is((SELECT count(*)::integer FROM exit_fixture), 4, 'four exit lifecycle fixtures are prepared');
INSERT INTO public.sessions(id, class_id, type, start_at, end_at, status, calendar_tombstone_until)
SELECT id, class_id, 'CLASS', now() + interval '1 day' + offset_at, now() + interval '1 day 90 minutes' + offset_at,
  CASE WHEN scenario = 'inactive' THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN scenario = 'tombstone' THEN now() + interval '90 days'
       WHEN scenario = 'expired-tombstone' THEN now() - interval '1 day' END
FROM exit_fixture;
INSERT INTO public.form_tokens(id, form_id, form_version_id, token_hash, access_type, submission_limit)
SELECT id, form_id, version_id, id::text, 'authenticated', 'one_per_token' FROM exit_fixture;
INSERT INTO public.student_exit_requests(id, workflow_key, student_id, form_id, form_version_id, form_token_id, requested_by)
SELECT id, 'student_unenrolment', '10000000-0000-0000-0000-000000000001', form_id, version_id, id,
  '00000000-0000-0000-0000-000000000001' FROM exit_fixture;
INSERT INTO public.student_exit_request_enrolments(id, student_exit_request_id, classes_students_id, final_session_at, unenrolled_at)
SELECT id, id, enrollment_id, now() + interval '1 day', now() + interval '2 days' FROM exit_fixture;

-- Older timestamp-only callers must refer to an actual operational session.
CREATE TEMP TABLE exit_results AS
SELECT f.*, public.complete_student_exit_request(id, '10000000-0000-0000-0000-000000000001', NULL,
  '{}'::jsonb, '[]'::jsonb, jsonb_build_array(jsonb_build_object('requestEnrolmentId', id,
    'finalSessionAt', (SELECT start_at FROM public.sessions WHERE sessions.id = f.id)))) AS result
FROM exit_fixture f ORDER BY expected, scenario;
SELECT is((result->>'success')::boolean, expected, 'exit completion eligibility: ' || scenario)
FROM exit_results ORDER BY scenario;
SELECT is(result->>'error', 'One of the selected sessions is no longer available.', 'stale exit choice: ' || scenario)
FROM exit_results WHERE NOT expected ORDER BY scenario;
SELECT is(EXISTS(SELECT 1 FROM public.form_responses response WHERE response.form_token_id = f.id), expected,
  'atomic exit response: ' || scenario) FROM exit_fixture f ORDER BY scenario;
SELECT is((SELECT status::text FROM public.student_exit_requests WHERE id = f.id),
  CASE WHEN expected THEN 'completed' ELSE 'pending' END, 'exit request state: ' || scenario)
FROM exit_fixture f ORDER BY scenario;
SELECT * FROM finish();
ROLLBACK;
