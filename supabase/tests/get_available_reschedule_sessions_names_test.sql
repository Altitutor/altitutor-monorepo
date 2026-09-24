BEGIN;

SELECT plan(4);

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
  (CURRENT_DATE + INTERVAL '2 days' + TIME '16:15')::TIMESTAMPTZ,
  (CURRENT_DATE + INTERVAL '2 days' + TIME '17:45')::TIMESTAMPTZ,
  'ACTIVE'
FROM public.classes
WHERE classes.id = '20000000-0000-4000-8000-00000000aa01';

CREATE TEMP TABLE reschedule_payload AS
SELECT public.get_available_reschedule_sessions(
  '50000000-0000-0000-0000-000000000005',
  '10000000-0000-0000-0000-000000000001',
  7
) AS payload;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload)) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  'a same-subject different-class future session is offered for reschedule'
);

SELECT isnt(
  (
    SELECT elem->>'short_name'
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload)) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  NULL,
  'replacement sessions include a stored session short_name'
);

SELECT is(
  (
    SELECT elem->>'short_name'
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload)) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  (
    SELECT sessions.short_name
    FROM public.sessions
    WHERE sessions.id = '50000000-0000-4000-8000-00000000aa01'
  ),
  'replacement session short_name matches the sessions row'
);

SELECT is(
  (
    SELECT elem->'class'->>'short_name'
    FROM jsonb_array_elements((SELECT payload FROM reschedule_payload)) elem
    WHERE elem->>'id' = '50000000-0000-4000-8000-00000000aa01'
  ),
  (
    SELECT classes.short_name
    FROM public.classes
    WHERE classes.id = '20000000-0000-4000-8000-00000000aa01'
  ),
  'replacement sessions include the stored class short_name'
);

SELECT * FROM finish();

ROLLBACK;
