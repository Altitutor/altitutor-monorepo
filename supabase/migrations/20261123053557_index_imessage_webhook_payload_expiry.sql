SET LOCAL lock_timeout = '2s';
SET LOCAL statement_timeout = '8s';

CREATE INDEX imessage_events_payload_expiry_idx
  ON public.imessage_events (processed_at, id)
  WHERE processed_at IS NOT NULL
    AND processing_error IS NULL
    AND payload <> '{}'::jsonb;
