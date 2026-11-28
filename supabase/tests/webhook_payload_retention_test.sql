BEGIN;
SELECT plan(16);

INSERT INTO public.stripe_webhook_events (
  stripe_event_id, event_type, event_data, processed, processed_at, error_message, created_at
)
SELECT
  'dev502-stripe-' || n,
  (ARRAY[
    'charge.succeeded',
    'invoice.payment_succeeded',
    'invoice_payment.paid',
    'invoiceitem.created',
    'payment_intent.created',
    'setup_intent.created'
  ])[1 + n % 6], '{"fixture":"stripe payload"}', TRUE,
  now() - CASE
    WHEN n = 1 THEN interval '92 days'
    WHEN n = 1001 THEN interval '90 days 1 second'
    ELSE interval '91 days'
  END,
  NULL, now() - interval '120 days'
FROM generate_series(1, 1001) AS n;

INSERT INTO public.imessage_events (
  event_key, event_type, connector_id, imessage_guid, temp_guid, payload,
  received_at, processed_at, processing_attempts
)
SELECT
  'dev502-imessage-' || n, 'new-message', 'dev502-connector', 'dev502-guid-' || n,
  'dev502-temp-' || n, '{"fixture":"mac payload"}', now() - interval '120 days',
  now() - CASE
    WHEN n = 1 THEN interval '92 days'
    WHEN n = 1001 THEN interval '90 days 1 second'
    ELSE interval '91 days'
  END,
  1
FROM generate_series(1, 1001) AS n;

INSERT INTO public.stripe_webhook_events (
  stripe_event_id, event_type, event_data, processed, processed_at, error_message, created_at
)
VALUES
  ('dev502-stripe-protected-recent', 'invoiceitem.created', '{"fixture":"protected"}',
    TRUE, now() - interval '89 days', NULL, now() - interval '120 days'),
  ('dev502-stripe-protected-boundary', 'invoiceitem.created', '{"fixture":"protected"}',
    TRUE, now() - interval '90 days', NULL, now() - interval '120 days'),
  ('dev502-stripe-protected-unprocessed', 'invoiceitem.created', '{"fixture":"protected"}',
    FALSE, now() - interval '91 days', NULL, now() - interval '120 days'),
  ('dev502-stripe-protected-error', 'invoiceitem.created', '{"fixture":"protected"}',
    TRUE, now() - interval '91 days', 'manual review', now() - interval '120 days'),
  ('dev502-stripe-protected-missing-time', 'invoiceitem.created', '{"fixture":"protected"}',
    TRUE, NULL, NULL, now() - interval '120 days'),
  ('dev502-stripe-protected-business-failure', 'checkout.session.completed', '{"fixture":"protected"}',
    TRUE, now() - interval '91 days', NULL, now() - interval '120 days'),
  ('dev502-stripe-protected-unknown', 'unknown.event', '{"fixture":"protected"}',
    TRUE, now() - interval '91 days', NULL, now() - interval '120 days');

INSERT INTO public.imessage_events (
  event_key, event_type, payload, received_at, processed_at, processing_error
)
VALUES
  ('dev502-imessage-protected-recent', 'new-message', '{"fixture":"protected"}',
    now() - interval '120 days', now() - interval '89 days', NULL),
  ('dev502-imessage-protected-boundary', 'new-message', '{"fixture":"protected"}',
    now() - interval '120 days', now() - interval '90 days', NULL),
  ('dev502-imessage-protected-unprocessed', 'new-message', '{"fixture":"protected"}',
    now() - interval '120 days', NULL, NULL),
  ('dev502-imessage-protected-error', 'new-message', '{"fixture":"protected"}',
    now() - interval '120 days', now() - interval '91 days', 'manual review');

CREATE TEMP TABLE stripe_original_metadata ON COMMIT DROP AS
SELECT to_jsonb(event) - 'event_data' AS snapshot
FROM public.stripe_webhook_events AS event
WHERE stripe_event_id = 'dev502-stripe-1';

CREATE TEMP TABLE imessage_original_metadata ON COMMIT DROP AS
SELECT to_jsonb(event) - 'payload' AS snapshot
FROM public.imessage_events AS event
WHERE event_key = 'dev502-imessage-1';

SELECT ok(
  NOT has_function_privilege('anon', 'private.expire_completed_webhook_payloads()', 'EXECUTE')
    AND NOT has_function_privilege('authenticated', 'private.expire_completed_webhook_payloads()', 'EXECUTE')
    AND NOT has_function_privilege('service_role', 'private.expire_completed_webhook_payloads()', 'EXECUTE'),
  'only maintenance roles can execute webhook payload expiry'
);

SELECT CASE
  WHEN to_regprocedure('cron.schedule(text,text,text)') IS NULL
    THEN pass('cron is unavailable on this fixture database')
  ELSE results_eq(
    $sql$ SELECT active AND username = current_user::text
      AND schedule = '2-59/5 * * * *'
      AND command LIKE '%SELECT private.expire_completed_webhook_payloads();%'
      FROM cron.job WHERE jobname = 'expire-completed-webhook-payloads' $sql$,
    'VALUES (TRUE)',
    'the migration role owns the active bounded maintenance job'
  )
END;

SELECT lives_ok(
  'SELECT private.expire_completed_webhook_payloads()',
  'the maintenance command processes the first batch'
);

SELECT is(
  (SELECT count(*) FROM public.stripe_webhook_events
   WHERE stripe_event_id LIKE 'dev502-stripe-%' AND event_data = '{}'::jsonb),
  1000::bigint, 'Stripe expiry rewrites at most 1,000 bodies per run'
);

SELECT is(
  (SELECT count(*) FROM public.imessage_events
   WHERE event_key LIKE 'dev502-imessage-%' AND payload = '{}'::jsonb),
  1000::bigint, 'iMessage expiry rewrites at most 1,000 bodies per run'
);

SELECT ok(
  (SELECT event_data = '{}'::jsonb FROM public.stripe_webhook_events
   WHERE stripe_event_id = 'dev502-stripe-1')
  AND (SELECT event_data = '{"fixture":"stripe payload"}'::jsonb FROM public.stripe_webhook_events
       WHERE stripe_event_id = 'dev502-stripe-1001'),
  'Stripe processes the oldest successful event bodies first'
);

SELECT ok(
  (SELECT payload = '{}'::jsonb FROM public.imessage_events
   WHERE event_key = 'dev502-imessage-1')
  AND (SELECT payload = '{"fixture":"mac payload"}'::jsonb FROM public.imessage_events
       WHERE event_key = 'dev502-imessage-1001'),
  'iMessage processes the oldest successful event bodies first'
);

SELECT is(
  (SELECT count(*) FROM public.stripe_webhook_events
   WHERE stripe_event_id LIKE 'dev502-stripe-protected-%' AND event_data = '{"fixture":"protected"}'::jsonb),
  7::bigint, 'Stripe keeps raw data for recent, failed, unresolved, ambiguous, and unaudited events'
);

SELECT is(
  (SELECT count(*) FROM public.imessage_events
   WHERE event_key LIKE 'dev502-imessage-protected-%' AND payload = '{"fixture":"protected"}'::jsonb),
  4::bigint, 'iMessage keeps raw data for recent, boundary-age, failed, and unresolved events'
);

SELECT is(
  (SELECT to_jsonb(event) - 'event_data' FROM public.stripe_webhook_events AS event
   WHERE stripe_event_id = 'dev502-stripe-1'),
  (SELECT snapshot FROM stripe_original_metadata),
  'Stripe keeps every other event field including identity and completed status'
);

SELECT is(
  (SELECT to_jsonb(event) - 'payload' FROM public.imessage_events AS event
   WHERE event_key = 'dev502-imessage-1'),
  (SELECT snapshot FROM imessage_original_metadata),
  'iMessage keeps every other inbox field including identity and completed status'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.stripe_webhook_events (stripe_event_id, event_type, event_data)
        VALUES ('dev502-stripe-1','invoice.paid','{"fixture":"retry"}') $sql$,
  '23505', NULL, 'Stripe still rejects a duplicate after the original body expires'
);

SELECT throws_ok(
  $sql$ INSERT INTO public.imessage_events (event_key, event_type, payload)
        VALUES ('dev502-imessage-1','new-message','{"fixture":"retry"}') $sql$,
  '23505', NULL, 'iMessage still rejects a duplicate after the original body expires'
);

SELECT lives_ok(
  'SELECT private.expire_completed_webhook_payloads()',
  'the next maintenance run can advance past expired bodies'
);

SELECT is(
  (SELECT count(*) FROM public.stripe_webhook_events
   WHERE stripe_event_id LIKE 'dev502-stripe-%' AND event_data = '{}'::jsonb),
  1001::bigint, 'the next run expires the remaining Stripe body'
);

SELECT is(
  (SELECT count(*) FROM public.imessage_events
   WHERE event_key LIKE 'dev502-imessage-%' AND payload = '{}'::jsonb),
  1001::bigint, 'the next run expires the remaining iMessage body'
);

SELECT * FROM finish();
ROLLBACK;
