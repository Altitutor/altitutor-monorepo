BEGIN;
SELECT plan(4);

SELECT is(
  (
    SELECT COUNT(*)::integer
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname = 'dashboard_new_class_students'
      AND procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=""']::text[]
      AND has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
      AND NOT has_function_privilege('anon', procedure.oid, 'EXECUTE')
  ),
  1,
  'new-student lookup is a fixed-path security-definer function for signed-in users'
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
  class_ids.class_id,
  subject.id,
  2,
  '16:15',
  '17:45',
  'ACTIVE',
  '2026-01-01',
  '2026-12-31'
FROM (
  SELECT subjects.id
  FROM public.subjects
  WHERE subjects.name = 'Mathematical Methods'
    AND subjects.year_level = 12
    AND subjects.curriculum = 'SACE'
  LIMIT 1
) AS subject
CROSS JOIN (
  VALUES
    ('d5100000-0000-4000-8000-000000000001'::uuid),
    ('d5100000-0000-4000-8000-000000000002'::uuid)
) AS class_ids(class_id);

INSERT INTO public.sessions (id, class_id, subject_id, type, start_at, end_at, status)
SELECT
  session_rows.session_id,
  session_rows.class_id,
  classes.subject_id,
  'CLASS',
  session_rows.start_at,
  session_rows.start_at + interval '90 minutes',
  session_rows.status
FROM (
  VALUES
    (
      'd5200000-0000-4000-8000-000000000001'::uuid,
      'd5100000-0000-4000-8000-000000000001'::uuid,
      '2026-08-15 06:45:00+00'::timestamptz,
      'ACTIVE'
    ),
    (
      'd5200000-0000-4000-8000-000000000002'::uuid,
      'd5100000-0000-4000-8000-000000000001'::uuid,
      '2026-08-25 06:45:00+00'::timestamptz,
      'INACTIVE'
    ),
    (
      'd5200000-0000-4000-8000-000000000003'::uuid,
      'd5100000-0000-4000-8000-000000000001'::uuid,
      '2026-09-08 06:45:00+00'::timestamptz,
      'ACTIVE'
    ),
    (
      'd5200000-0000-4000-8000-000000000004'::uuid,
      'd5100000-0000-4000-8000-000000000002'::uuid,
      '2026-09-08 08:00:00+00'::timestamptz,
      'ACTIVE'
    )
) AS session_rows(session_id, class_id, start_at, status)
JOIN public.classes ON classes.id = session_rows.class_id;

INSERT INTO public.sessions_staff (id, session_id, staff_id, type)
VALUES (
  'd5300000-0000-4000-8000-000000000001',
  'd5200000-0000-4000-8000-000000000003',
  '00000000-0000-0000-0000-000000000010',
  'MAIN_TUTOR'
);

-- Extra appearances that are not class enrolments.
INSERT INTO public.sessions_students (id, session_id, student_id)
VALUES
  (
    'd5400000-0000-4000-8000-000000000001',
    'd5200000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000006'
  ),
  (
    'd5400000-0000-4000-8000-000000000002',
    'd5200000-0000-4000-8000-000000000003',
    '10000000-0000-0000-0000-000000000003'
  );

INSERT INTO public.classes_students (id, class_id, student_id, enrolled_at, enrolled_by)
VALUES
  (
    'd5500000-0000-4000-8000-000000000001',
    'd5100000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000002',
    '2026-08-01 00:00:00+00',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'd5500000-0000-4000-8000-000000000002',
    'd5100000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000005',
    '2026-08-01 00:00:00+00',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'd5500000-0000-4000-8000-000000000003',
    'd5100000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '2026-08-20 00:00:00+00',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'd5500000-0000-4000-8000-000000000004',
    'd5100000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    '2026-08-20 00:00:00+00',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'd5500000-0000-4000-8000-000000000005',
    'd5100000-0000-4000-8000-000000000001',
    '10000000-0000-0000-0000-000000000006',
    '2026-09-08 06:45:00+00',
    '00000000-0000-0000-0000-000000000001'
  ),
  (
    'd5500000-0000-4000-8000-000000000006',
    'd5100000-0000-4000-8000-000000000002',
    '10000000-0000-0000-0000-000000000008',
    '2026-09-01 00:00:00+00',
    '00000000-0000-0000-0000-000000000001'
  );

INSERT INTO public.sessions_students (id, session_id, student_id)
VALUES (
  'd5400000-0000-4000-8000-000000000003',
  'd5200000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000001'
);

UPDATE public.sessions_students AS earlier
SET
  planned_absence = true,
  is_rescheduled = true,
  rescheduled_sessions_students_id = today.id
FROM public.sessions_students AS today
WHERE earlier.session_id = 'd5200000-0000-4000-8000-000000000001'
  AND earlier.student_id = '10000000-0000-0000-0000-000000000005'
  AND today.session_id = 'd5200000-0000-4000-8000-000000000003'
  AND today.student_id = earlier.student_id;

UPDATE public.sessions_students
SET planned_absence = true
WHERE session_id = 'd5200000-0000-4000-8000-000000000003'
  AND student_id = '10000000-0000-0000-0000-000000000004';

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT results_eq(
  $$
    SELECT student_id::text
    FROM public.dashboard_new_class_students(ARRAY[
      'd5200000-0000-4000-8000-000000000003'::uuid,
      'd5200000-0000-4000-8000-000000000004'::uuid
    ])
    ORDER BY 1
  $$,
  $$
    SELECT unnest(ARRAY[
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000006',
      '10000000-0000-0000-0000-000000000008'
    ]::text[])
    ORDER BY 1
  $$,
  'admin sees enrolled students attending their first class session'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT results_eq(
  $$
    SELECT student_id::text
    FROM public.dashboard_new_class_students(ARRAY[
      'd5200000-0000-4000-8000-000000000003'::uuid,
      'd5200000-0000-4000-8000-000000000004'::uuid
    ])
    ORDER BY 1
  $$,
  $$
    SELECT unnest(ARRAY[
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000005',
      '10000000-0000-0000-0000-000000000006'
    ]::text[])
    ORDER BY 1
  $$,
  'a tutor only sees new students on sessions they are assigned to'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000009","role":"authenticated"}',
  true
);

SELECT throws_ok(
  $$
    SELECT *
    FROM public.dashboard_new_class_students(ARRAY[
      'd5200000-0000-4000-8000-000000000003'::uuid
    ])
  $$,
  '42501',
  'Forbidden',
  'students cannot read the new-student list'
);

SELECT * FROM finish();
ROLLBACK;
