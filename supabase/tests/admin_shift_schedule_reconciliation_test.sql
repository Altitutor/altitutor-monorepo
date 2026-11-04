BEGIN;

SELECT plan(14);

INSERT INTO public.admin_shifts (
  id,
  day_of_week,
  start_time,
  end_time,
  status,
  session_start_date,
  session_end_date
) VALUES (
  'a3020000-0000-4000-8000-000000000001',
  1,
  '09:00',
  '10:00',
  'ACTIVE',
  DATE '2027-01-04',
  DATE '2027-01-31'
);

INSERT INTO public.admin_shifts_staff (
  id,
  admin_shift_id,
  staff_id,
  assigned_at
)
SELECT
  'a3020000-0000-4000-8000-000000000002',
  'a3020000-0000-4000-8000-000000000001',
  staff.id,
  TIMESTAMPTZ '2027-01-01 00:00:00+00'
FROM public.staff
WHERE staff.role = 'ADMINSTAFF'
  AND staff.status = 'ACTIVE'
ORDER BY staff.id
LIMIT 1;

INSERT INTO public.sessions_students (session_id, student_id)
SELECT session.id, '10000000-0000-0000-0000-000000000001'
FROM public.sessions session
WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
  AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-25';

CREATE TEMP TABLE changed_admin_shift AS
SELECT jsonb_build_object(
  'admin_shift_id', 'a3020000-0000-4000-8000-000000000001',
  'day_of_week', 2,
  'start_time', '10:00',
  'end_time', '11:00',
  'status', 'ACTIVE',
  'start_date', '2027-01-04',
  'end_date', '2027-01-31',
  'effective_from', '2027-01-12',
  'timezone', 'Australia/Adelaide'
) AS proposal;

SELECT is(
  (SELECT (public.preview_admin_shift_schedule(proposal)->'counts'->>'create')::INTEGER FROM changed_admin_shift),
  3,
  'preview creates the new Tuesday sessions from the effective date'
);

SELECT is(
  (SELECT (public.preview_admin_shift_schedule(proposal)->'counts'->>'cancel')::INTEGER FROM changed_admin_shift),
  1,
  'preview cancels only the pristine Monday session on or after the effective date'
);

SELECT is(
  (SELECT (public.preview_admin_shift_schedule(proposal)->'counts'->>'protected')::INTEGER FROM changed_admin_shift),
  1,
  'preview protects the Monday session that already has an appointment'
);

SELECT throws_ok(
  format(
    'SELECT public.preview_admin_shift_schedule(%L::jsonb)',
    jsonb_build_object(
      'admin_shift_id', 'a3020000-0000-4000-8000-000000000001',
      'day_of_week', 2,
      'start_time', '10:00',
      'end_time', '11:00',
      'status', 'ACTIVE',
      'start_date', '2000-01-01',
      'end_date', '2099-12-31',
      'effective_from', ((NOW() AT TIME ZONE 'Australia/Adelaide')::DATE - 1)::TEXT,
      'timezone', 'Australia/Adelaide'
    )::TEXT
  ),
  'P0001',
  'The schedule effective date must be today or later',
  'an effective date before today is rejected'
);

SELECT throws_ok(
  $$UPDATE public.admin_shifts
    SET day_of_week = 3
    WHERE id = 'a3020000-0000-4000-8000-000000000001'$$,
  'P0001',
  'Admin shift schedule changes must use the timetable preview',
  'direct Admin shift schedule changes cannot bypass the effective date'
);

SELECT throws_ok(
  $$SELECT public.apply_admin_shift_schedule(proposal, 'stale-hash') FROM changed_admin_shift$$,
  'P0001',
  'The Admin shift changed after preview; preview it again',
  'apply refuses a plan that no longer matches the preview'
);

SELECT lives_ok(
  $$SELECT public.apply_admin_shift_schedule(
      proposal,
      public.preview_admin_shift_schedule(proposal)->>'proposal_hash'
    )
    FROM changed_admin_shift$$,
  'apply accepts the previewed effective-dated change'
);

SELECT results_eq(
  $$SELECT (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE
    FROM public.sessions session
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND session.status = 'ACTIVE'
      AND session.calendar_tombstone_until IS NULL
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE < DATE '2027-01-12'
    ORDER BY session.start_at$$,
  $$SELECT DATE '2027-01-04'
    UNION ALL SELECT DATE '2027-01-11'$$,
  'sessions before the effective date stay on the previous Monday timetable'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions session
    JOIN public.sessions_staff assignment ON assignment.session_id = session.id
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-04'
  ),
  1,
  'staffing on sessions before the effective date stays in place'
);

SELECT is(
  (
    SELECT session.status || COALESCE(session.calendar_tombstone_until IS NOT NULL, FALSE)::TEXT
    FROM public.sessions session
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-18'
  ),
  'INACTIVEtrue',
  'the pristine Monday on the effective-date boundary becomes a cancellation tombstone'
);

SELECT results_eq(
  $$SELECT
      (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE,
      session.status,
      (session.calendar_tombstone_until IS NULL)
    FROM public.sessions session
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::TIME = TIME '10:00'
    ORDER BY session.start_at$$,
  $$VALUES
      (DATE '2027-01-12', 'ACTIVE'::TEXT, TRUE),
      (DATE '2027-01-19', 'ACTIVE'::TEXT, TRUE),
      (DATE '2027-01-26', 'ACTIVE'::TEXT, TRUE)$$,
  'the new timetable starts on the effective date'
);

SELECT is(
  (
    SELECT session.status
    FROM public.sessions session
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-25'
  ),
  'ACTIVE',
  'the appointment on the old timetable stays after the effective date'
);

SELECT results_eq(
  $$SELECT revision.effective_from, revision.effective_to, revision.day_of_week
    FROM public.admin_shift_schedule_revisions revision
    WHERE revision.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND revision.superseded_at IS NULL
    ORDER BY revision.effective_from$$,
  $$VALUES
      (DATE '2027-01-04', DATE '2027-01-11', 1::SMALLINT),
      (DATE '2027-01-12', DATE '2027-01-31', 2::SMALLINT)$$,
  'the previous timetable ends the day before the effective date'
);

DELETE FROM public.sessions_staff
WHERE session_id IN (
  SELECT session.id
  FROM public.sessions session
  WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
    AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-04'
);

SELECT public.precreate_admin_shift_sessions(
  DATE '2027-01-04',
  DATE '2027-01-31',
  NULL,
  'a3020000-0000-4000-8000-000000000001'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions_staff assignment
    JOIN public.sessions session ON session.id = assignment.session_id
    WHERE session.admin_shift_id = 'a3020000-0000-4000-8000-000000000001'
      AND (session.start_at AT TIME ZONE 'Australia/Adelaide')::DATE = DATE '2027-01-04'
  ),
  0,
  'filling later sessions does not restore staffing removed before the effective date'
);

SELECT * FROM finish();
ROLLBACK;
