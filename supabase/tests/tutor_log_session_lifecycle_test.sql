BEGIN;
SELECT no_plan();

CREATE TEMP TABLE logging_fixture (
  scenario text, actor uuid, session_id uuid PRIMARY KEY, expected boolean
);
INSERT INTO logging_fixture
SELECT scenario || '-' || actor.name, actor.id,
  md5('logging-lifecycle-' || scenario || '-' || actor.name)::uuid, expected
FROM (VALUES ('active', true), ('inactive', false), ('tombstone', false),
  ('expired_tombstone', false), ('trial', true), ('check_in', true)) cases(scenario, expected)
CROSS JOIN (VALUES ('admin', '00000000-0000-0000-0000-000000000001'::uuid),
  ('tutor', '00000000-0000-0000-0000-000000000010'::uuid)) actor(name, id);

INSERT INTO public.sessions (id, type, start_at, end_at, status, calendar_tombstone_until)
SELECT session_id,
  CASE WHEN scenario LIKE 'trial-%' THEN 'TRIAL_SESSION'::public.session_type
       WHEN scenario LIKE 'check_in-%' THEN 'CHECK_IN'::public.session_type
       ELSE 'CLASS'::public.session_type END,
  now() - interval '2 days', now() - interval '2 days' + interval '90 minutes',
  CASE WHEN scenario LIKE 'inactive-%' THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN scenario LIKE 'tombstone-%' THEN now() + interval '90 days'
       WHEN scenario LIKE 'expired_tombstone-%' THEN now() - interval '1 day' END
FROM logging_fixture;
INSERT INTO public.sessions_staff (session_id, staff_id, type)
SELECT session_id, '00000000-0000-0000-0000-000000000010',
  CASE WHEN scenario LIKE 'check_in-%' THEN 'CHECK_IN_HOST' ELSE 'MAIN_TUTOR' END
FROM logging_fixture;
INSERT INTO public.sessions_students (session_id, student_id)
SELECT session_id, '10000000-0000-0000-0000-000000000001' FROM logging_fixture;

SELECT is(EXISTS (SELECT 1 FROM public.vadmin_reconciliation_unlogged_sessions v
  WHERE v.session_id = f.session_id), f.expected, 'admin unlogged queue: ' || f.scenario)
FROM logging_fixture f ORDER BY scenario;

-- TutorWeb applies lifecycle filtering through the assigned-tutor facade.
GRANT SELECT ON logging_fixture TO authenticated;
SELECT set_config('request.jwt.claim.sub', (
  SELECT user_id::text FROM public.staff WHERE id = '00000000-0000-0000-0000-000000000010'
), true);
SET LOCAL ROLE authenticated;
SELECT is(EXISTS (SELECT 1 FROM public.vtutor_sessions v
  WHERE v.session_id = f.session_id AND v.session_status = 'ACTIVE'
    AND v.calendar_tombstone_until IS NULL
    AND NOT EXISTS (SELECT 1 FROM public.vtutor_tutor_log l WHERE l.session_id = v.session_id)),
  f.expected, 'tutor unlogged queue: ' || f.scenario)
FROM logging_fixture f ORDER BY scenario;
SELECT is((SELECT count(*)::integer FROM public.vtutor_sessions
  WHERE session_id IN (SELECT session_id FROM logging_fixture)), 12,
  'assigned tutor still sees cancelled session history through the general facade');
RESET ROLE;

CREATE TEMP TABLE logging_results AS
SELECT f.*, public.create_tutor_log(
  p_session_id => session_id, p_created_by => actor,
  p_logged_for_staff_id => '00000000-0000-0000-0000-000000000010',
  p_student_attendance => '[{"studentId":"10000000-0000-0000-0000-000000000001","attended":true}]'::jsonb
) AS result
FROM logging_fixture f;

SELECT is((result->>'success')::boolean, expected, 'RPC logging eligibility: ' || scenario)
FROM logging_results ORDER BY scenario;
SELECT is(result->>'error', 'Cannot log an inactive or cancelled session.',
  'RPC reports cancellation: ' || scenario)
FROM logging_results WHERE NOT expected ORDER BY scenario;
SELECT is(EXISTS (SELECT 1 FROM public.tutor_logs l WHERE l.session_id = f.session_id),
  f.expected, 'atomic log creation: ' || f.scenario)
FROM logging_fixture f ORDER BY scenario;
SELECT is(EXISTS (SELECT 1 FROM public.tutor_logs_student_attendance a
  JOIN public.tutor_logs l ON l.id = a.tutor_log_id
  WHERE l.session_id = f.session_id AND a.attended), f.expected,
  'atomic attendance insertion: ' || f.scenario)
FROM logging_fixture f ORDER BY scenario;

-- Historical corrections remain possible after a genuinely held session is cancelled.
UPDATE public.sessions SET status = 'INACTIVE', calendar_tombstone_until = now() + interval '90 days'
WHERE id = md5('logging-lifecycle-active-admin')::uuid;
SELECT is(public.update_tutor_log(
  p_tutor_log_id => (SELECT id FROM public.tutor_logs WHERE session_id = md5('logging-lifecycle-active-admin')::uuid),
  p_updated_by => '00000000-0000-0000-0000-000000000001',
  p_logged_for_staff_id => '00000000-0000-0000-0000-000000000010',
  p_student_attendance => '[{"studentId":"10000000-0000-0000-0000-000000000001","attended":false}]'::jsonb
)->>'success', 'true', 'admin can correct an existing log after cancellation');

SELECT * FROM finish();
ROLLBACK;
