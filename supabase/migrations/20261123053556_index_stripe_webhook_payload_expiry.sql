-- Build separately from the iMessage index so each provider's write lock is
-- released before the next migration starts.
SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '8s';

CREATE INDEX stripe_webhook_events_payload_expiry_idx
  ON public.stripe_webhook_events (processed_at, id)
  WHERE processed
    AND processed_at IS NOT NULL
    AND error_message IS NULL
    AND event_data <> '{}'::jsonb;
