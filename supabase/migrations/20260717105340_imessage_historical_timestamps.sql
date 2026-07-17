-- Historical iMessages were initially inserted with the reconciliation
-- processing time in created_at. Restore their original provider timestamps.

UPDATE public.messages
SET
  created_at = COALESCE(sent_at, received_at, created_at),
  status_updated_at = COALESCE(
    read_at,
    delivered_at,
    sent_at,
    received_at,
    created_at
  )
WHERE is_historical_import;
