BEGIN;

SELECT plan(11);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  TRUE
);
SET LOCAL ROLE authenticated;

SELECT has_column(
  'public',
  'classes',
  'billing_type',
  'Classes expose their latest configured billing type'
);

SELECT has_column(
  'public',
  'class_schedule_revisions',
  'billing_type',
  'effective-dated Class revisions own billing type'
);

SELECT is(
  (
    SELECT attribute.attgenerated::TEXT
    FROM pg_catalog.pg_attribute attribute
    JOIN pg_catalog.pg_class relation ON relation.oid = attribute.attrelid
    JOIN pg_catalog.pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'sessions'
      AND attribute.attname = 'billing_type'
  ),
  '',
  'Session billing type is a stored snapshot rather than a generated value'
);

CREATE TEMP TABLE class_billing_test_proposal AS
WITH bounds AS (
  SELECT
    (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE + 1 AS start_date,
    (NOW() AT TIME ZONE 'Australia/Adelaide')::DATE + 15 AS end_date
)
SELECT jsonb_build_object(
  'class_id', '90000000-0000-0000-0000-000000000170',
  'subject_id', (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'billing_type', 'EXAM_COURSE',
  'cohort_label', 'Billing type test',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', bounds.start_date,
  'end_date', bounds.end_date,
  'effective_from', bounds.start_date,
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', bounds.start_date,
  'recurring_rows', jsonb_build_array(jsonb_build_object(
    'day_of_week', EXTRACT(DOW FROM bounds.start_date)::INTEGER,
    'start_time', '13:00',
    'end_time', '14:30',
    'room', 'Billing room',
    'position', 0
  ))
) AS proposal
FROM bounds;

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM class_billing_test_proposal
  $$,
  'a Class can be created with a non-default billing type'
);

SELECT is(
  (
    SELECT billing_type::TEXT
    FROM public.class_schedule_revisions
    WHERE class_id = '90000000-0000-0000-0000-000000000170'
      AND superseded_at IS NULL
  ),
  'EXAM_COURSE',
  'the effective Class revision stores the selected billing type'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000170'
      AND billing_type = 'EXAM_COURSE'
  ),
  3,
  'new child Sessions inherit the Class billing type'
);

UPDATE public.sessions
SET room = 'Exceptional billing room'
WHERE id = (
  SELECT id
  FROM public.sessions
  WHERE class_id = '90000000-0000-0000-0000-000000000170'
  ORDER BY start_at DESC
  LIMIT 1
);

UPDATE class_billing_test_proposal
SET proposal = jsonb_set(
  jsonb_set(proposal, '{billing_type}', '"DRAFTING"'),
  '{effective_from}',
  to_jsonb(((proposal->>'start_date')::DATE + 7)::TEXT)
);

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM class_billing_test_proposal
  $$,
  'a Class billing change can share the schedule effective date'
);

SELECT is(
  (
    SELECT billing_type::TEXT
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000170'
    ORDER BY start_at
    LIMIT 1
  ),
  'EXAM_COURSE',
  'a child Session before the effective date keeps its earlier billing type'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000170'
      AND start_at >= (
        SELECT ((proposal->>'effective_from')::DATE + TIME '00:00') AT TIME ZONE 'Australia/Adelaide'
        FROM class_billing_test_proposal
      )
      AND billing_type = 'DRAFTING'
  ),
  2,
  'all child Sessions on or after the effective date inherit the new billing type'
);

SELECT is(
  (
    SELECT billing_type::TEXT
    FROM public.sessions
    WHERE class_id = '90000000-0000-0000-0000-000000000170'
      AND is_schedule_exception
  ),
  'DRAFTING',
  'future schedule exceptions also inherit the Class billing change'
);

INSERT INTO public.sessions (id, type, start_at, end_at)
VALUES (
  '90000000-0000-0000-0000-000000000171',
  'EXAM_COURSE',
  NOW() + INTERVAL '1 day',
  NOW() + INTERVAL '2 hours 1 day'
);

SELECT is(
  (
    SELECT billing_type::TEXT
    FROM public.sessions
    WHERE id = '90000000-0000-0000-0000-000000000171'
  ),
  'EXAM_COURSE',
  'standalone billable Sessions retain type-derived billing behavior'
);

SELECT * FROM finish();

ROLLBACK;
