BEGIN;
SELECT plan(8);

-- Synthetic existing booking and enrolment; explicit existing tutor minimizes
-- unrelated slot allocation while retaining the real eligibility/RPC path.
UPDATE public.students SET status = 'TRIAL'
WHERE id = '10000000-0000-0000-0000-000000000001';
INSERT INTO public.sessions (id, type, start_at, end_at, status, subject_id)
VALUES
('fa213000-0000-4000-8000-000000000001', 'SUBSIDY_INTERVIEW', now() + interval '30 days', now() + interval '30 days 1 hour', 'ACTIVE', (SELECT id FROM public.subjects ORDER BY id LIMIT 1)),
('fa213000-0000-4000-8000-000000000002', 'TRIAL_SESSION', now() + interval '31 days', now() + interval '31 days 1 hour', 'ACTIVE', (SELECT id FROM public.subjects ORDER BY id LIMIT 1)),
('fa213000-0000-4000-8000-000000000003', 'DRAFTING', now() + interval '32 days', now() + interval '32 days 1 hour', 'ACTIVE', (SELECT id FROM public.subjects ORDER BY id LIMIT 1));
INSERT INTO public.sessions_students (session_id, student_id)
SELECT id, '10000000-0000-0000-0000-000000000001'
FROM public.sessions WHERE id IN (
'fa213000-0000-4000-8000-000000000001',
'fa213000-0000-4000-8000-000000000002',
'fa213000-0000-4000-8000-000000000003'
);
CREATE FUNCTION pg_temp.move_booking(p_id uuid, p_type public.session_type)
RETURNS uuid LANGUAGE sql AS $$
  SELECT public.reschedule_session(
    p_original_session_id => p_id,
    p_student_id => '10000000-0000-0000-0000-000000000001',
    p_session_type => p_type,
    p_start_at => now() + interval '60 days',
    p_end_at => now() + interval '60 days 1 hour',
    p_staff_id => '00000000-0000-0000-0000-000000000010',
    p_bypass_date_restrictions => false
  );
$$;
SELECT lives_ok(
  $$ SELECT pg_temp.move_booking('fa213000-0000-4000-8000-000000000001', 'SUBSIDY_INTERVIEW') $$,
  'a trial Student can reschedule an existing subsidy interview'
);
SELECT is(
  (SELECT start_at FROM public.sessions WHERE id='fa213000-0000-4000-8000-000000000001'),
  now() + interval '60 days',
  'the same subsidy interview identity persists at the requested new time'
);
SELECT is(
  (SELECT count(*)::integer FROM public.sessions_students
    WHERE session_id='fa213000-0000-4000-8000-000000000001'
      AND student_id='10000000-0000-0000-0000-000000000001' AND NOT planned_absence),
  1, 'the original Student assignment remains attached'
);
SELECT lives_ok(
  $$ SELECT pg_temp.move_booking('fa213000-0000-4000-8000-000000000002', 'TRIAL_SESSION') $$,
  'existing trial-session rescheduling remains permitted'
);
SELECT throws_ok(
  $$ SELECT pg_temp.move_booking('fa213000-0000-4000-8000-000000000003', 'DRAFTING') $$,
  'P0001', 'Failed to reschedule session: Trial students cannot reschedule DRAFTING sessions. Convert to active first.',
  'trial Students still cannot reschedule drafting'
);
SELECT throws_ok(
  $$ SELECT pg_temp.move_booking('fa213000-0000-4000-8000-000000000001', 'TRIAL_SESSION') $$,
  'P0001', 'Failed to reschedule session: Original session type (SUBSIDY_INTERVIEW) does not match requested session type (TRIAL_SESSION)',
  'requested type must still match the original booking'
);
UPDATE public.students SET status='DISCONTINUED' WHERE id='10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
  $$ SELECT pg_temp.move_booking('fa213000-0000-4000-8000-000000000001', 'SUBSIDY_INTERVIEW') $$,
  'P0001', 'Failed to reschedule session: Discontinued students cannot reschedule sessions',
  'discontinued Students remain ineligible'
);
UPDATE public.students SET status='TRIAL' WHERE id='10000000-0000-0000-0000-000000000001';
SELECT throws_ok(
  $$ SELECT public.reschedule_session(
    'fa213000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002', 'SUBSIDY_INTERVIEW',
    now()+interval '61 days', now()+interval '61 days 1 hour',
    p_staff_id => '00000000-0000-0000-0000-000000000010',
    p_bypass_date_restrictions => false
  ) $$,
  'P0001', 'Failed to reschedule session: Original session not found, already marked as absence, or does not belong to student',
  'a different Student cannot reschedule this booking'
);
SELECT * FROM finish();
ROLLBACK;
