BEGIN;

SELECT plan(9);

INSERT INTO public.automation_rules (
  id,
  name,
  entity_type,
  event_names,
  trigger_kind,
  trigger_config,
  enabled
) VALUES (
  'fe000000-0000-4000-8000-000000000001',
  'Payment method lifecycle test',
  'students',
  ARRAY['student.payment_method_added'],
  'EVENT',
  '{}'::JSONB,
  TRUE
);

SELECT lives_ok(
  $$INSERT INTO public.student_payment_methods (
      id,
      student_id,
      stripe_payment_method_id,
      is_default,
      card_brand,
      card_last4,
      card_exp_month,
      card_exp_year
    ) VALUES (
      'fe000000-0000-4000-8000-000000000002',
      '10000000-0000-0000-0000-000000000001',
      'pm_lifecycle_test',
      FALSE,
      'visa',
      '4242',
      8,
      2032
    )$$,
  'adding a payment method succeeds'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.domain_events
    WHERE event_name = 'student.payment_method_added'
      AND idempotency_key = 'payment-method:fe000000-0000-4000-8000-000000000002:added'
  ),
  1::BIGINT,
  'adding a payment method records one explicit lifecycle event'
);

SELECT ok(
  (
    SELECT payload->>'card_last4' = '4242'
      AND payload->>'card_brand' = 'visa'
      AND payload::TEXT NOT LIKE '%pm_lifecycle_test%'
    FROM public.domain_events
    WHERE idempotency_key = 'payment-method:fe000000-0000-4000-8000-000000000002:added'
  ),
  'the event keeps safe display details without storing the Stripe payment-method id'
);

SELECT lives_ok(
  $$UPDATE public.student_payment_methods
    SET card_exp_year = 2033
    WHERE id = 'fe000000-0000-4000-8000-000000000002'$$,
  'Stripe detail synchronization can update the stored row'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.domain_events
    WHERE subject_id = '10000000-0000-0000-0000-000000000001'
      AND event_name LIKE 'student.payment_method_%'
      AND recorded_at >= transaction_timestamp()
  ),
  1::BIGINT,
  'payment-method updates do not create activity events'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.automation_executions
    WHERE rule_id = 'fe000000-0000-4000-8000-000000000001'
      AND event_name = 'student.payment_method_added'
  ),
  1::BIGINT,
  'the exact lifecycle event transactionally enqueues its matching automation'
);

SELECT lives_ok(
  $$DELETE FROM public.student_payment_methods
    WHERE id = 'fe000000-0000-4000-8000-000000000002'$$,
  'removing a payment method succeeds'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.domain_events
    WHERE event_name = 'student.payment_method_removed'
      AND idempotency_key = 'payment-method:fe000000-0000-4000-8000-000000000002:removed'
  ),
  1::BIGINT,
  'removing a payment method records one explicit lifecycle event'
);

CREATE TEMP TABLE linked_student_parent AS
SELECT student_id, parent_id
FROM public.parents_students
ORDER BY created_at
LIMIT 1;

SELECT public.record_domain_event(
  'student.registered',
  'student',
  (SELECT student_id FROM linked_student_parent),
  '[]'::JSONB,
  '{}'::JSONB,
  NOW(),
  NULL,
  NULL,
  'domain-event-parent-direct-only-test',
  'test',
  FALSE
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vadmin_domain_event_feed
    WHERE id = (
      SELECT id FROM public.domain_events
      WHERE idempotency_key = 'domain-event-parent-direct-only-test'
    )
      AND linked_entity_type = 'parent'
      AND linked_entity_id = (SELECT parent_id FROM linked_student_parent)
  ),
  0::BIGINT,
  'a linked parent feed does not aggregate the student lifecycle event'
);

SELECT * FROM finish();
ROLLBACK;
