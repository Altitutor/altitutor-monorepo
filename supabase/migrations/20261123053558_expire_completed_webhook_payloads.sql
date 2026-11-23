SET LOCAL lock_timeout = '2s';

CREATE FUNCTION private.expire_completed_webhook_payloads()
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = ''
SET lock_timeout = '1s'
AS $function$
  -- Stripe's processed flag also covers some handled events with follow-up
  -- failures. Only the audited receipt-only cohort is eligible.
  WITH batch AS (
    SELECT id
    FROM public.stripe_webhook_events
    WHERE processed
      AND processed_at IS NOT NULL
      AND error_message IS NULL
      AND event_type IN (
        'charge.succeeded',
        'invoice.payment_succeeded',
        'invoice_payment.paid',
        'invoiceitem.created',
        'payment_intent.created',
        'setup_intent.created'
      )
      AND event_data <> '{}'::jsonb
      AND processed_at < now() - interval '90 days'
    ORDER BY processed_at, id
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.stripe_webhook_events AS event
  SET event_data = '{}'::jsonb
  FROM batch
  WHERE event.id = batch.id;

  WITH batch AS (
    SELECT id
    FROM public.imessage_events
    WHERE processed_at IS NOT NULL
      AND processing_error IS NULL
      AND payload <> '{}'::jsonb
      AND processed_at < now() - interval '90 days'
    ORDER BY processed_at, id
    LIMIT 1000
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.imessage_events AS event
  SET payload = '{}'::jsonb
  FROM batch
  WHERE event.id = batch.id;
$function$;

REVOKE ALL ON FUNCTION private.expire_completed_webhook_payloads()
  FROM PUBLIC, anon, authenticated, service_role;

COMMENT ON COLUMN public.stripe_webhook_events.event_data IS
  'Raw Stripe webhook payload. An empty JSON object marks an expired body in the audited receipt-only cohort; the event ID and processing outcome are retained.';

COMMENT ON COLUMN public.imessage_events.payload IS
  'Raw Mac webhook payload. An empty JSON object marks an expired body; the inbox event key and processing outcome are retained.';

DO $migration$
BEGIN
  IF to_regprocedure('cron.schedule(text,text,text)') IS NULL THEN
    RAISE NOTICE 'Skipping webhook payload expiry schedule: pg_cron unavailable.';
    RETURN;
  END IF;

  PERFORM cron.schedule(
    'expire-completed-webhook-payloads',
    '2-59/5 * * * *',
    $cron$
    SET LOCAL statement_timeout = '15s';
    SELECT private.expire_completed_webhook_payloads();
    $cron$
  );
END;
$migration$;
