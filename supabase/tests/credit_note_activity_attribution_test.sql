BEGIN;

SELECT plan(6);

SELECT is(
  public.credit_note_lifecycle_event_payload(
    jsonb_build_object(
      'id', 'fe210000-0000-4000-8000-000000000099',
      'amount_cents', 5000,
      'currency', 'AUD',
      'reason', 'order_change',
      'credit_amount_cents', 5000,
      'billing_adjustment_id', 'fe210000-0000-4000-8000-000000000098',
      'metadata', jsonb_build_object(
        'memo', 'Family holiday',
        'internal_note', 'Approved by office',
        'reason_category', 'approved_absence',
        'reason_note', 'Family holiday'
      )
    ),
    'admin_discretion',
    'should not win'
  ),
  jsonb_build_object(
    'credit_note_id', 'fe210000-0000-4000-8000-000000000099',
    'credit_note_type', 'credit',
    'amount_cents', 5000,
    'currency', 'AUD',
    'reason', 'order_change',
    'memo', 'Family holiday',
    'internal_note', 'Approved by office',
    'reason_category', 'approved_absence',
    'reason_note', 'Family holiday',
    'billing_adjustment_id', 'fe210000-0000-4000-8000-000000000098'
  ),
  'the credit-note payload helper keeps memo, internal note, and session-billing why'
);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  currency,
  status
) VALUES (
  'fe210000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'in_credit_note_actor_metadata',
  'INV-CN-ACTOR-1',
  '2099-03-01',
  9000,
  0,
  'AUD',
  'open'
);

INSERT INTO public.credit_notes (
  id,
  invoice_id,
  stripe_credit_note_id,
  amount_cents,
  currency,
  reason,
  status,
  credit_amount_cents,
  metadata
) VALUES (
  'fe210000-0000-4000-8000-000000000011',
  'fe210000-0000-4000-8000-000000000001',
  'cn_credit_note_actor_metadata',
  9000,
  'AUD',
  'duplicate',
  'issued',
  9000,
  jsonb_build_object(
    'created_by_staff_id', '00000000-0000-0000-0000-000000000001',
    'created_by_staff_name', 'Admin User',
    'memo', 'Duplicate invoice line',
    'internal_note', 'Raised from the invoice dialog'
  )
);

SELECT is(
  (
    SELECT actor_staff_id
    FROM public.domain_events
    WHERE event_name = 'invoice.credit_note_added'
      AND idempotency_key = 'credit-note:fe210000-0000-4000-8000-000000000011:added'
  ),
  '00000000-0000-0000-0000-000000000001'::uuid,
  'a manual credit note records the staff id from Stripe metadata, not System'
);

SELECT is(
  (
    SELECT payload->>'memo'
    FROM public.domain_events
    WHERE event_name = 'invoice.credit_note_added'
      AND idempotency_key = 'credit-note:fe210000-0000-4000-8000-000000000011:added'
  ),
  'Duplicate invoice line',
  'a manual credit note stores the memo the staff entered'
);

SELECT is(
  (
    SELECT actor_name
    FROM public.vadmin_domain_event_feed
    WHERE id = (
      SELECT id
      FROM public.domain_events
      WHERE idempotency_key = 'credit-note:fe210000-0000-4000-8000-000000000011:added'
    )
    LIMIT 1
  ),
  'Admin User',
  'the activity feed names the staff member who added the credit note'
);

INSERT INTO public.sessions (
  id,
  type,
  subject_id,
  start_at,
  end_at,
  status,
  billing_type
)
SELECT
  'fe210000-0000-4000-8000-000000000031',
  source.type,
  source.subject_id,
  now() - interval '3 days',
  now() - interval '3 days' + interval '90 minutes',
  'ACTIVE',
  source.billing_type
FROM public.sessions source
WHERE source.billing_type IS NOT NULL
LIMIT 1;

INSERT INTO public.sessions_students (
  id,
  session_id,
  student_id,
  planned_absence,
  is_credited,
  is_rescheduled,
  was_trial
) VALUES (
  'fe210000-0000-4000-8000-000000000032',
  'fe210000-0000-4000-8000-000000000031',
  '10000000-0000-0000-0000-000000000001',
  false,
  false,
  false,
  false
);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  currency,
  status
) VALUES (
  'fe210000-0000-4000-8000-000000000002',
  '10000000-0000-0000-0000-000000000001',
  'in_credit_note_actor_adjustment',
  'INV-CN-ACTOR-2',
  '2099-03-02',
  9000,
  0,
  'AUD',
  'open'
);

INSERT INTO public.invoice_items (
  id,
  invoice_id,
  sessions_students_id,
  stripe_invoice_item_id,
  amount_cents,
  description,
  is_subsidy,
  is_fee,
  line_kind,
  session_id,
  student_id
) VALUES (
  'fe210000-0000-4000-8000-000000000033',
  'fe210000-0000-4000-8000-000000000002',
  'fe210000-0000-4000-8000-000000000032',
  'ii_credit_note_actor_adjustment',
  9000,
  'Session fee',
  false,
  false,
  'session_charge',
  'fe210000-0000-4000-8000-000000000031',
  '10000000-0000-0000-0000-000000000001'
);

INSERT INTO public.session_billing_adjustments (
  id,
  sessions_students_id,
  kind,
  source_invoice_item_id,
  reason_category,
  reason_note,
  created_by,
  idempotency_key,
  status,
  amount_cents
) VALUES (
  'fe210000-0000-4000-8000-000000000021',
  'fe210000-0000-4000-8000-000000000032',
  'credit_note',
  'fe210000-0000-4000-8000-000000000033',
  'approved_absence',
  'Sick with flu',
  '00000000-0000-0000-0000-000000000001',
  'test-credit-note-activity-attribution',
  'succeeded',
  9000
);

INSERT INTO public.credit_notes (
  id,
  invoice_id,
  stripe_credit_note_id,
  amount_cents,
  currency,
  reason,
  status,
  credit_amount_cents,
  billing_adjustment_id,
  metadata
) VALUES (
  'fe210000-0000-4000-8000-000000000012',
  'fe210000-0000-4000-8000-000000000002',
  'cn_credit_note_actor_adjustment',
  9000,
  'AUD',
  'order_change',
  'issued',
  9000,
  'fe210000-0000-4000-8000-000000000021',
  jsonb_build_object(
    'billing_adjustment_id', 'fe210000-0000-4000-8000-000000000021',
    'reason_category', 'approved_absence',
    'memo', 'Session absence credit'
  )
);

SELECT ok(
  (
    SELECT actor_staff_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND payload->>'reason_category' = 'approved_absence'
      AND payload->>'reason_note' = 'Sick with flu'
    FROM public.domain_events
    WHERE event_name = 'invoice.credit_note_added'
      AND idempotency_key = 'credit-note:fe210000-0000-4000-8000-000000000012:added'
  ),
  'an absence-reconciliation credit note attributes the staff who logged it and stores the absence why'
);

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  stripe_invoice_number,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  currency,
  status
) VALUES (
  'fe210000-0000-4000-8000-000000000003',
  '10000000-0000-0000-0000-000000000001',
  'in_credit_note_actor_system',
  'INV-CN-ACTOR-3',
  '2099-03-03',
  4000,
  0,
  'AUD',
  'open'
);

INSERT INTO public.credit_notes (
  id,
  invoice_id,
  stripe_credit_note_id,
  amount_cents,
  currency,
  reason,
  status,
  metadata
) VALUES (
  'fe210000-0000-4000-8000-000000000013',
  'fe210000-0000-4000-8000-000000000003',
  'cn_credit_note_actor_system',
  4000,
  'AUD',
  'order_change',
  'issued',
  '{}'::jsonb
);

SELECT ok(
  (
    SELECT actor_staff_id IS NULL
    FROM public.domain_events
    WHERE event_name = 'invoice.credit_note_added'
      AND idempotency_key = 'credit-note:fe210000-0000-4000-8000-000000000013:added'
  ),
  'a credit note with no staff metadata or billing adjustment still records as System'
);

SELECT * FROM finish();
ROLLBACK;
