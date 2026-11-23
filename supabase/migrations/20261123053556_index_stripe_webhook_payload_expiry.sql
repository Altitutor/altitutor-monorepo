-- Build separately from the iMessage index so each provider's write lock is
-- released before the next migration starts.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '8s';

-- The Stripe handler only acknowledges these types. Before deploying dedicated
-- processing for any of them, remove it from the expiry function and this
-- partial index in a forward migration, so new outcomes keep their bodies.
-- See supabase/scripts/webhook-payload-retention.test.mjs.
CREATE INDEX stripe_webhook_events_payload_expiry_idx
  ON public.stripe_webhook_events (processed_at, id)
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
    AND event_data <> '{}'::jsonb;
