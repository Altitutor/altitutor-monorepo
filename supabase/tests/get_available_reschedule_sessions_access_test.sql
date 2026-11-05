BEGIN;
SELECT plan(3);

INSERT INTO public.classes (
  id,
  subject_id,
  day_of_week,
  start_time,
  end_time,
  status,
  session_start_date,
  session_end_date
)
SELECT
  '20000000-0000-4000-8000-00000000aa01',
  subjects.id,
  3,
  '16:15',
  '17:45',
  'ACTIVE',
  '2026-01-01',
  '2026-12-31'
FROM public.subjects
WHERE subjects.name = 'Mathematical Methods'
  AND subjects.year_level = 12
  AND subjects.curriculum = 'SACE'
LIMIT 1;

INSERT INTO public.sessions (
  id,
  class_id,
  subject_id,
  type,
  start_at,
  end_at,
  status
)
SELECT
  '50000000-0000-4000-8000-00000000aa01',
  '20000000-0000-4000-8000-00000000aa01',
  classes.subject_id,
  'CLASS',
  (CURRENT_DATE + INTERVAL '2 days' + TIME '16:15')::timestamptz,
  (CURRENT_DATE + INTERVAL '2 days' + TIME '17:45')::timestamptz,
  'ACTIVE'
FROM public.classes
WHERE classes.id = '20000000-0000-4000-8000-00000000aa01';

CREATE TEMP TABLE reschedule_payload (
  caller text,
  payload jsonb
);
GRANT ALL ON TABLE reschedule_payload TO authenticated;

SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO reschedule_payload
SELECT 'admin', public.get_available_reschedule_sessions(
  '50000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  7
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
INSERT INTO reschedule_payload
SELECT 'student', public.get_available_reschedule_sessions(
  '50000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  7
);
RESET ROLE;

SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
SET LOCAL ROLE authenticated;
SELECT throws_ok(
  $$SELECT public.get_available_reschedule_sessions(
    '50000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000001',
    7
  )$$,
  '42501',
  'Reschedule availability requires the student or active AdminStaff',
  'an unrelated student cannot read another student''s reschedule sessions'
);
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload WHERE caller = 'admin')) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  'active AdminStaff still receives the replacement session'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload WHERE caller = 'student')) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  'the owning student still receives the replacement session'
);

SELECT * FROM finish();
ROLLBACK;
