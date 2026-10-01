BEGIN;

SELECT plan(12);

SELECT ok(
  EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist'),
  'btree_gist is available for the subsidy exclusion constraint'
);

SELECT is(
  (
    SELECT constraint_row.contype::text
    FROM pg_constraint constraint_row
    JOIN pg_class relation ON relation.oid = constraint_row.conrelid
    JOIN pg_namespace namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
      AND relation.relname = 'student_subsidies'
      AND constraint_row.conname = 'student_subsidies_no_overlap'
  ),
  'x',
  'a student can have only one subsidy for a subject and billing type at a time'
);

SELECT is(
  (
    SELECT constraint_row.condeferrable AND NOT constraint_row.condeferred
    FROM pg_constraint constraint_row
    WHERE constraint_row.conname = 'student_subsidies_no_overlap'
  ),
  true,
  'subsidy overlaps are rejected immediately and can be deferred while a rate is rewritten'
);

INSERT INTO public.student_subsidies (
  id, student_id, subject_id, billing_type, price_cents, effective_from, effective_until, created_by
)
SELECT
  'c1000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000010',
  subject.id,
  'CLASS',
  1000,
  '2026-01-01 00:00:00+00',
  '2026-06-01 00:00:00+00',
  '00000000-0000-0000-0000-000000000001'
FROM public.subjects subject
ORDER BY subject.id
LIMIT 1;

SELECT throws_ok(
  $$
    INSERT INTO public.student_subsidies (
      id, student_id, subject_id, billing_type, price_cents, effective_from, effective_until, created_by
    )
    SELECT
      'c1000000-0000-4000-8000-000000000002',
      '10000000-0000-0000-0000-000000000010',
      subject.id,
      'CLASS',
      500,
      '2026-05-01 00:00:00+00',
      '2026-07-01 00:00:00+00',
      '00000000-0000-0000-0000-000000000001'
    FROM public.subjects subject
    ORDER BY subject.id
    LIMIT 1
  $$,
  '23P01',
  'conflicting key value violates exclusion constraint "student_subsidies_no_overlap"',
  'a second effective subsidy for the same subject and billing type is rejected'
);

SELECT lives_ok(
  $$
    INSERT INTO public.student_subsidies (
      id, student_id, subject_id, billing_type, price_cents, effective_from, effective_until, created_by
    )
    SELECT
      'c1000000-0000-4000-8000-000000000003',
      '10000000-0000-0000-0000-000000000010',
      subject.id,
      'CLASS',
      500,
      '2026-06-01 00:00:00+00',
      NULL,
      '00000000-0000-0000-0000-000000000001'
    FROM public.subjects subject
    ORDER BY subject.id
    LIMIT 1
  $$,
  'a subsidy may start at the instant the previous one ends'
);

SET CONSTRAINTS student_subsidies_no_overlap DEFERRED;

INSERT INTO public.student_subsidies (
  id, student_id, subject_id, billing_type, price_cents, effective_from, effective_until, created_by
)
SELECT
  subsidy.id,
  subsidy.student_id,
  subject.id,
  'CLASS',
  subsidy.price_cents,
  subsidy.effective_from,
  subsidy.effective_until,
  '00000000-0000-0000-0000-000000000001'
FROM (
  VALUES
    (
      'c2000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000003'::uuid,
      1000,
      '2026-01-05 00:00:00+00'::timestamptz,
      NULL::timestamptz
    ),
    (
      'c2000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000003'::uuid,
      500,
      '2026-09-14 00:00:00+00'::timestamptz,
      NULL::timestamptz
    ),
    (
      'c3000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000004'::uuid,
      1000,
      '2026-01-14 00:00:00+00'::timestamptz,
      NULL::timestamptz
    ),
    (
      'c3000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000004'::uuid,
      500,
      '2026-09-14 00:00:00+00'::timestamptz,
      '2026-11-01 00:00:00+00'::timestamptz
    ),
    (
      'c4000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000006'::uuid,
      1000,
      '2026-01-01 00:00:00+00'::timestamptz,
      NULL::timestamptz
    ),
    (
      'c4000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000006'::uuid,
      500,
      '2026-01-01 00:00:00+00'::timestamptz,
      NULL::timestamptz
    )
) AS subsidy(id, student_id, price_cents, effective_from, effective_until)
CROSS JOIN LATERAL (
  SELECT id FROM public.subjects ORDER BY id LIMIT 1
) AS subject;

SELECT public.resolve_overlapping_student_subsidies();

SELECT is(
  (
    SELECT effective_until
    FROM public.student_subsidies
    WHERE id = 'c2000000-0000-4000-8000-000000000001'
  ),
  '2026-09-14 00:00:00+00'::timestamptz,
  'an open-ended newer subsidy ends the earlier open-ended rate'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.student_subsidies
    WHERE student_id = '10000000-0000-0000-0000-000000000004'
      AND price_cents = 1000
      AND effective_from = '2026-11-01 00:00:00+00'::timestamptz
      AND effective_until IS NULL
  ),
  1,
  'a temporary subsidy resumes the earlier rate when it ends'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.student_subsidies
    WHERE student_id = '10000000-0000-0000-0000-000000000006'
  ),
  1,
  'equal start times keep only the subsidy with the greatest id'
);

SELECT lives_ok(
  'SET CONSTRAINTS student_subsidies_no_overlap IMMEDIATE',
  'rewritten subsidy ranges do not overlap'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);

INSERT INTO public.student_subsidies (
  id, student_id, subject_id, billing_type, price_cents, effective_from, effective_until, created_by
)
SELECT
  subsidy.id,
  subsidy.student_id,
  subject.id,
  'CLASS',
  1000,
  subsidy.effective_from,
  NULL,
  '00000000-0000-0000-0000-000000000001'
FROM (
  VALUES
    (
      'c5000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000001'::uuid,
      '2026-01-14 00:00:00+00'::timestamptz
    ),
    (
      'c6000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid,
      '2026-01-05 00:00:00+00'::timestamptz
    )
) AS subsidy(id, student_id, effective_from)
CROSS JOIN LATERAL (
  SELECT id FROM public.subjects ORDER BY id LIMIT 1
) AS subject;

SET LOCAL ROLE authenticated;

SELECT public.save_student_subsidy(
  NULL,
  '10000000-0000-0000-0000-000000000001',
  (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS',
  500,
  'AUD',
  '2026-09-14 00:00:00+00',
  '2026-11-01 00:00:00+00'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.student_subsidies
    WHERE student_id = '10000000-0000-0000-0000-000000000001'
      AND (
        (id = 'c5000000-0000-4000-8000-000000000001' AND effective_until = '2026-09-14 00:00:00+00')
        OR (price_cents = 500 AND effective_from = '2026-09-14 00:00:00+00' AND effective_until = '2026-11-01 00:00:00+00')
        OR (price_cents = 1000 AND effective_from = '2026-11-01 00:00:00+00' AND effective_until IS NULL)
      )
  ),
  3,
  'saving a temporary rate splits the subsidy it replaces'
);

SELECT public.save_student_subsidy(
  NULL,
  '10000000-0000-0000-0000-000000000002',
  (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
  'CLASS',
  500,
  'AUD',
  '2026-09-14 00:00:00+00',
  NULL
);

SELECT is(
  (
    SELECT effective_until
    FROM public.student_subsidies
    WHERE id = 'c6000000-0000-4000-8000-000000000001'
  ),
  '2026-09-14 00:00:00+00'::timestamptz,
  'saving an open-ended rate ends the previous open-ended subsidy'
);

SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000009","role":"authenticated"}',
  true
);
SELECT set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000009', true);

SELECT throws_ok(
  $$
    SELECT public.save_student_subsidy(
      NULL,
      '10000000-0000-0000-0000-000000000001',
      (SELECT id FROM public.subjects ORDER BY id LIMIT 1),
      'CLASS',
      100,
      'AUD',
      '2027-01-01 00:00:00+00',
      NULL
    )
  $$,
  '42501',
  'Forbidden',
  'only active admin staff can save a subsidy'
);

SELECT * FROM finish();

ROLLBACK;
