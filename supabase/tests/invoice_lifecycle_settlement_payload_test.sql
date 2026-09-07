BEGIN;

SELECT plan(4);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  amount_paid_from_balance_cents,
  currency,
  status,
  paid_at
) VALUES (
  'fe200000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'in_settlement_payload_test',
  'INV-SETTLE-1',
  '2099-02-01',
  0,
  15000,
  2000,
  'AUD',
  'paid',
  TIMESTAMPTZ '2099-02-01 10:00:00+00'
);

SELECT ok(
  (
    SELECT payload->>'amount_paid_from_balance_cents' = '2000'
      AND payload->>'amount_paid_from_card_cents' = '13000'
      AND payload->>'amount_paid_cents' = '15000'
    FROM public.domain_events
    WHERE event_name = 'invoice.paid'
      AND subject_id = 'fe200000-0000-4000-8000-000000000001'
  ),
  'paying an invoice records card vs credit-balance settlement in the paid event'
);

SELECT ok(
  (
    SELECT payload->>'amount_paid_from_balance_cents' = '2000'
      AND payload->>'amount_paid_from_card_cents' = '13000'
    FROM public.domain_events
    WHERE event_name = 'invoice.issued'
      AND subject_id = 'fe200000-0000-4000-8000-000000000001'
  ),
  'issuing an already-paid invoice also snapshots the settlement split'
);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  amount_paid_from_balance_cents,
  currency,
  status
) VALUES (
  'fe200000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'in_settlement_payload_update_test',
  'INV-SETTLE-2',
  '2099-02-02',
  8000,
  0,
  0,
  'AUD',
  'open'
);

UPDATE public.invoices
SET
  status = 'paid',
  paid_at = TIMESTAMPTZ '2099-02-02 11:00:00+00',
  amount_due_cents = 0,
  amount_paid_cents = 8000,
  amount_paid_from_balance_cents = 8000
WHERE id = 'fe200000-0000-4000-8000-000000000002';

SELECT ok(
  (
    SELECT payload->>'amount_paid_from_balance_cents' = '8000'
      AND payload->>'amount_paid_from_card_cents' = '0'
      AND payload->>'amount_paid_cents' = '8000'
    FROM public.domain_events
    WHERE event_name = 'invoice.paid'
      AND subject_id = 'fe200000-0000-4000-8000-000000000002'
  ),
  'a later paid update records a credit-balance-only settlement'
);

SELECT is(
  public.invoice_lifecycle_event_payload(jsonb_build_object(
    'amount_due_cents', 0,
    'amount_paid_cents', 5000,
    'amount_paid_from_balance_cents', 1500,
    'currency', 'AUD',
    'status', 'paid'
  ))->>'amount_paid_from_card_cents',
  '3500',
  'the settlement helper derives the card portion from paid minus credit balance'
);

SELECT * FROM finish();
ROLLBACK;
