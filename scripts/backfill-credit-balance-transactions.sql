-- Backfill credit_balance_transactions from historical credit notes
-- Run once after deploying the migration that makes stripe_credit_grant_id nullable.
--
-- Sources:
--   1. Credit notes with credit_amount_cents > 0 (from stripe_webhook_events)
--   2. Does NOT cover direct balance adjustments (customers.createBalanceTransaction)
--      - Those require a separate script that calls Stripe API
--
-- Usage:
--   supabase db execute -f scripts/backfill-credit-balance-transactions.sql
--   Or run via Supabase MCP execute_sql (paste the INSERT below)

INSERT INTO public.credit_balance_transactions (
  stripe_credit_balance_transaction_id,
  stripe_customer_id,
  stripe_credit_grant_id,
  stripe_invoice_id,
  invoice_id,
  credit_note_id,
  type,
  amount_cents,
  currency,
  credit_type,
  description,
  effective_at,
  raw
)
SELECT
  swe.event_data->'data'->'object'->>'customer_balance_transaction' AS stripe_credit_balance_transaction_id,
  swe.event_data->'data'->'object'->>'customer' AS stripe_customer_id,
  NULL AS stripe_credit_grant_id,
  swe.event_data->'data'->'object'->>'invoice' AS stripe_invoice_id,
  i.id AS invoice_id,
  cn.id AS credit_note_id,
  'credit' AS type,
  COALESCE(
    (swe.event_data->'data'->'object'->>'amount')::int,
    cn.amount_cents
  ) AS amount_cents,
  LOWER(COALESCE(swe.event_data->'data'->'object'->>'currency', 'aud')) AS currency,
  'credit_note' AS credit_type,
  'Credit note ' || (swe.event_data->'data'->'object'->>'id') || ' applied to customer balance (backfill)' AS description,
  to_timestamp(
    COALESCE(
      (swe.event_data->'data'->'object'->>'effective_at')::bigint,
      (swe.event_data->'data'->'object'->>'created')::bigint,
      extract(epoch from swe.created_at)::bigint
    )
  ) AT TIME ZONE 'UTC' AS effective_at,
  jsonb_build_object(
    'credit_note_id', swe.event_data->'data'->'object'->>'id',
    'amount', swe.event_data->'data'->'object'->>'amount',
    'currency', swe.event_data->'data'->'object'->>'currency',
    'customer_balance_transaction', swe.event_data->'data'->'object'->>'customer_balance_transaction',
    'invoice', swe.event_data->'data'->'object'->>'invoice',
    'customer', swe.event_data->'data'->'object'->>'customer',
    'created', swe.event_data->'data'->'object'->>'created',
    'effective_at', swe.event_data->'data'->'object'->>'effective_at',
    'backfill', true
  ) AS raw
FROM public.stripe_webhook_events swe
JOIN public.invoices i ON i.stripe_invoice_id = swe.event_data->'data'->'object'->>'invoice'
JOIN public.credit_notes cn ON cn.stripe_credit_note_id = swe.event_data->'data'->'object'->>'id'
WHERE swe.event_type = 'credit_note.created'
  AND swe.event_data->'data'->'object'->>'customer_balance_transaction' IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.credit_balance_transactions cbt
    WHERE cbt.stripe_credit_balance_transaction_id = swe.event_data->'data'->'object'->>'customer_balance_transaction'
  )
ON CONFLICT (stripe_credit_balance_transaction_id) DO NOTHING;
