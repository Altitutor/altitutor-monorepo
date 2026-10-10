BEGIN;
SELECT no_plan();
CREATE TEMP TABLE command_fixture AS
SELECT scenario, kind, expected,
  md5('operational-command-' || scenario || '-' || kind)::uuid AS id,
  md5('operational-target-' || scenario || '-' || kind)::uuid AS target_id
FROM (VALUES ('active', true), ('inactive', false), ('tombstone', false),
  ('expired-tombstone', false)) cases(scenario, expected)
CROSS JOIN (VALUES ('student-admin'), ('student-self'), ('staff')) kinds(kind);
INSERT INTO command_fixture
SELECT scenario, 'student-self', false,
  md5('operational-command-' || scenario)::uuid,
  md5('operational-target-' || scenario)::uuid
FROM (VALUES ('target-inactive'), ('target-tombstone'), ('target-expired-tombstone')) cases(scenario);
INSERT INTO public.sessions(id, type, start_at, end_at, status, calendar_tombstone_until)
SELECT id, 'CLASS', now() + interval '1 day', now() + interval '1 day 90 minutes',
  CASE WHEN scenario = 'inactive' THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN scenario = 'tombstone' THEN now() + interval '90 days'
       WHEN scenario = 'expired-tombstone' THEN now() - interval '1 day' END
FROM command_fixture;
INSERT INTO public.sessions(id, type, start_at, end_at, status, calendar_tombstone_until)
SELECT target_id, 'CLASS', now() + interval '2 days', now() + interval '2 days 90 minutes',
  CASE WHEN scenario = 'target-inactive' THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN scenario = 'target-tombstone' THEN now() + interval '90 days'
       WHEN scenario = 'target-expired-tombstone' THEN now() - interval '1 day' END
FROM command_fixture WHERE kind = 'student-self';
INSERT INTO public.sessions_students(id, session_id, student_id)
SELECT id, id, '10000000-0000-0000-0000-000000000001' FROM command_fixture WHERE kind <> 'staff';
INSERT INTO public.sessions_staff(id, session_id, staff_id, type)
SELECT id, id, '00000000-0000-0000-0000-000000000010', 'MAIN_TUTOR' FROM command_fixture WHERE kind = 'staff';

CREATE TEMP TABLE command_results AS
SELECT f.*, CASE kind
  WHEN 'student-admin' THEN public.log_student_absences(
    jsonb_build_array(jsonb_build_object('student_id', '10000000-0000-0000-0000-000000000001',
      'original_sessions_students_id', id, 'action', 'credit')),
    '00000000-0000-0000-0000-000000000001')
  WHEN 'student-self' THEN public.log_student_absences_self(
    jsonb_build_array(jsonb_build_object('student_id', '10000000-0000-0000-0000-000000000001',
      'original_sessions_students_id', id, 'action', 'reschedule', 'target_session_id', target_id)),
    '10000000-0000-0000-0000-000000000001')
  ELSE public.log_staff_absences(
    jsonb_build_array(jsonb_build_object('staff_id', '00000000-0000-0000-0000-000000000010',
      'original_sessions_staff_id', id, 'action', 'log')),
    '00000000-0000-0000-0000-000000000001') END AS result
FROM command_fixture f;
SELECT is((result->>'success')::boolean, expected, 'command eligibility: ' || kind || '/' || scenario)
FROM command_results ORDER BY kind, scenario;
SELECT is(result->>'error', 'Cannot change attendance for an inactive or cancelled session.',
  'stale selection error: ' || kind || '/' || scenario)
FROM command_results WHERE NOT expected ORDER BY kind, scenario;
SELECT is((SELECT planned_absence FROM public.sessions_students WHERE id = f.id), expected,
  'atomic student absence: ' || kind || '/' || scenario)
FROM command_fixture f WHERE kind <> 'staff' ORDER BY kind, scenario;
SELECT is((SELECT planned_absence FROM public.sessions_staff WHERE id = f.id), expected,
  'atomic staff absence: ' || scenario)
FROM command_fixture f WHERE kind = 'staff' ORDER BY scenario;
SELECT * FROM finish();
ROLLBACK;
