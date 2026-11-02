BEGIN;

SELECT plan(4);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'uq_sessions_class_start_end'
      AND indexdef ILIKE '%UNIQUE%'
      AND indexdef ILIKE '%(class_id, start_at, end_at)%'
      AND indexdef ILIKE '%class_id IS NOT NULL%'
      AND indexdef ILIKE '%status = ''ACTIVE''%'
  ),
  'only an active class session occupies a start and end'
);

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
  'a2470000-0000-4000-8000-000000000001',
  subjects.id,
  4,
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

INSERT INTO public.sessions (id, class_id, subject_id, type, start_at, end_at, status)
SELECT
  session_rows.session_id,
  'a2470000-0000-4000-8000-000000000001',
  classes.subject_id,
  'CLASS',
  session_rows.start_at,
  session_rows.end_at,
  session_rows.status
FROM public.classes
CROSS JOIN (
  VALUES
    (
      'a2470000-0000-4000-8000-000000000011'::uuid,
      '2031-03-05 07:15:00+00'::timestamptz,
      '2031-03-05 08:45:00+00'::timestamptz,
      'INACTIVE'
    ),
    (
      'a2470000-0000-4000-8000-000000000012'::uuid,
      '2031-03-05 05:45:00+00'::timestamptz,
      '2031-03-05 07:15:00+00'::timestamptz,
      'ACTIVE'
    )
) AS session_rows(session_id, start_at, end_at, status)
WHERE classes.id = 'a2470000-0000-4000-8000-000000000001';

SELECT lives_ok(
  $$
    UPDATE public.sessions
    SET start_at = '2031-03-05 07:15:00+00',
        end_at = '2031-03-05 08:45:00+00'
    WHERE id = 'a2470000-0000-4000-8000-000000000012'
  $$,
  'an active session can move onto a time held by an inactive session of the same class'
);

SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM public.sessions
    WHERE class_id = 'a2470000-0000-4000-8000-000000000001'
      AND start_at = '2031-03-05 07:15:00+00'
      AND end_at = '2031-03-05 08:45:00+00'
  ),
  2,
  'the inactive session remains beside the moved active session'
);

SELECT throws_ok(
  $$
    INSERT INTO public.sessions (id, class_id, subject_id, type, start_at, end_at, status)
    SELECT
      'a2470000-0000-4000-8000-000000000013',
      id,
      subject_id,
      'CLASS',
      '2031-03-05 07:15:00+00',
      '2031-03-05 08:45:00+00',
      'ACTIVE'
    FROM public.classes
    WHERE id = 'a2470000-0000-4000-8000-000000000001'
  $$,
  '23505',
  'duplicate key value violates unique constraint "uq_sessions_class_start_end"',
  'a second active session at that class, start, and end is rejected'
);

SELECT * FROM finish();

ROLLBACK;
