BEGIN;

SELECT plan(3);

INSERT INTO public.student_subscriptions (
  id,
  student_id,
  subject_id,
  stripe_subscription_id,
  stripe_price_id,
  status,
  current_period_start,
  current_period_end,
  cancel_at_period_end,
  cancel_at,
  plan_tier,
  billing_interval
)
SELECT
  fixture.id,
  fixture.student_id,
  subject.id,
  fixture.stripe_subscription_id,
  'price_facade_test',
  'active',
  '2026-08-12T10:33:30Z',
  '2026-09-12T10:33:30Z',
  true,
  '2026-09-12T10:33:30Z',
  'unlimited',
  'month'
FROM (
  VALUES
    (
      'fa000000-0000-4000-8000-000000000001'::uuid,
      '10000000-0000-0000-0000-000000000001'::uuid,
      'sub_facade_student_one'
    ),
    (
      'fa000000-0000-4000-8000-000000000002'::uuid,
      '10000000-0000-0000-0000-000000000002'::uuid,
      'sub_facade_student_two'
    )
) AS fixture(id, student_id, stripe_subscription_id)
CROSS JOIN LATERAL (
  SELECT id
  FROM public.subjects
  WHERE name = 'UCAT'
  LIMIT 1
) AS subject;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.student_subscriptions),
  0::bigint,
  'students cannot read the student_subscriptions base table'
);

SELECT is(
  (SELECT count(*) FROM public.vstudent_subscriptions),
  1::bigint,
  'the student subscription facade returns the current student subscription'
);

SELECT results_eq(
  $$
    SELECT cancel_at_period_end, cancel_at
    FROM public.vstudent_subscriptions
  $$,
  $$
    VALUES (
      true,
      '2026-09-12T10:33:30Z'::timestamptz
    )
  $$,
  'the facade exposes the current student cancellation schedule only'
);

SELECT * FROM finish();

ROLLBACK;
