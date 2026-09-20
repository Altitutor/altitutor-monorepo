BEGIN;

SELECT plan(34);

INSERT INTO public.sessions (id, type, subject_id, start_at, end_at, status, billing_type)
SELECT 'fa000000-0000-4000-8000-000000000001', type, subject_id,
  now() - interval '2 days', now() - interval '2 days' + interval '90 minutes', 'ACTIVE', billing_type
FROM public.sessions WHERE billing_type IS NOT NULL LIMIT 1;

INSERT INTO public.sessions_students (
  id, session_id, student_id, planned_absence, is_credited, is_rescheduled, was_trial
) VALUES (
  'fa000000-0000-4000-8000-000000000002', 'fa000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001', true, true, false, false
);

CREATE TEMP TABLE credit_command_fixture AS
SELECT id AS sessions_students_id, session_id, student_id
FROM public.sessions_students WHERE id = 'fa000000-0000-4000-8000-000000000002';

INSERT INTO public.invoices (
  id, student_id, stripe_invoice_id, invoice_date,
  amount_due_cents, amount_paid_cents, currency, status
)
SELECT
  'fa100000-0000-4000-8000-000000000001', student_id,
  'in_credit_command_test', current_date, 9000, 0, 'AUD', 'open'
FROM credit_command_fixture;

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id,
  amount_cents, description, is_subsidy, is_fee, session_id, student_id, line_kind
)
SELECT
  'fa200000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000001', sessions_students_id,
  'ii_credit_command_test', 9000, 'Credit command test line',
  false, false, session_id, student_id, 'session_charge'
FROM credit_command_fixture;

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, source_invoice_item_id,
  amount_cents, reason_category, idempotency_key, attempt_count, stripe_credit_note_request_version
)
SELECT
  fixture.id, assignment.sessions_students_id, fixture.kind::public.session_billing_adjustment_kind,
  fixture.status::public.session_billing_adjustment_status,
  CASE WHEN fixture.kind = 'credit_note' THEN 'fa200000-0000-4000-8000-000000000001'::uuid END,
  9000, 'approved_absence', fixture.key, fixture.attempts, NULL
FROM credit_command_fixture assignment
CROSS JOIN (VALUES
  ('fa300000-0000-4000-8000-000000000001'::uuid, 'credit_note', 'processing', 'command:first', 1),
  ('fa300000-0000-4000-8000-000000000002'::uuid, 'credit_note', 'processing', 'command:legacy', 2),
  ('fa300000-0000-4000-8000-000000000003'::uuid, 'credit_note', 'pending', 'command:pending', 0),
  ('fa300000-0000-4000-8000-000000000004'::uuid, 'session_charge', 'processing', 'command:charge', 1),
  ('fa300000-0000-4000-8000-000000000006'::uuid, 'credit_note', 'processing', 'command:new-retry', 2)
) AS fixture(id, kind, status, key, attempts);

CREATE FUNCTION pg_temp.credit_command(p_key text)
RETURNS jsonb
LANGUAGE sql
AS $$
  SELECT jsonb_build_object(
    'idempotencyKey', p_key,
    'params', jsonb_build_object(
      'invoice', 'in_credit_command_test',
      'lines', jsonb_build_array(jsonb_build_object(
        'type', 'invoice_line_item', 'invoice_line_item', 'il_credit_command_test', 'amount', 9000
      )),
      'reason', 'order_change',
      'memo', 'Original absence note',
      'email_type', 'none'
    ),
    'invoiceId', 'fa100000-0000-4000-8000-000000000001',
    'studentId', student_id::text,
    'sourceInvoiceItemId', 'fa200000-0000-4000-8000-000000000001'
  )
  FROM credit_command_fixture;
$$;

SELECT is(
  (SELECT stripe_credit_note_command FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  NULL::jsonb,
  'new adjustments have no request snapshot'
);
SELECT is(
  (SELECT stripe_credit_note_requested_at FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  NULL::timestamptz,
  'new adjustments have no request timestamp'
);

SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('command:legacy') WHERE idempotency_key = 'command:legacy'$$,
  '23514', 'A Stripe credit note command requires opted-in processing work',
  'legacy attempted work cannot reconstruct a request from current state'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET attempt_count = 1, stripe_credit_note_command = pg_temp.credit_command('command:legacy') WHERE idempotency_key = 'command:legacy'$$,
  '23514', 'A Stripe credit note command requires opted-in processing work',
  'resetting the attempt count cannot disguise an existing attempt while saving'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('command:pending') WHERE idempotency_key = 'command:pending'$$,
  '23514', 'A Stripe credit note command requires opted-in processing work',
  'unclaimed work cannot save a request'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('command:charge') WHERE idempotency_key = 'command:charge'$$,
  '23514', 'A Stripe credit note command requires opted-in processing work',
  'charge adjustments cannot save credit note requests'
);
UPDATE public.session_billing_adjustments SET stripe_credit_note_request_version = 1 WHERE idempotency_key = 'command:first';

SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('different-key') WHERE idempotency_key = 'command:first'$$,
  '23514', 'new row for relation "session_billing_adjustments" violates check constraint "session_billing_credit_note_command_shape"',
  'the snapshot must use the adjustment durable key'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_requested_at = now() WHERE idempotency_key = 'command:first'$$,
  '23514', 'A Stripe credit note request timestamp requires a saved command',
  'a timestamp cannot be saved without a request'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = '{}'::jsonb WHERE idempotency_key = 'command:first'$$,
  '23514', 'new row for relation "session_billing_adjustments" violates check constraint "session_billing_credit_note_command_shape"',
  'an incomplete envelope cannot masquerade as a saved request'
);

SELECT lives_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_request_version = 1 WHERE idempotency_key = 'command:first'$$,
  'a new worker opts in on its first claimed attempt before preparing the request'
);
SELECT lives_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('command:first'), stripe_credit_note_requested_at = '2000-01-01' WHERE idempotency_key = 'command:first'$$,
  'the first processing attempt can save its request'
);
SELECT is(
  (SELECT stripe_credit_note_requested_at FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  now(),
  'the database supplies the request time rather than trusting a caller timestamp'
);
SELECT is(
  (SELECT stripe_credit_note_command FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  pg_temp.credit_command('command:first'),
  'the complete envelope is preserved'
);

SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = jsonb_set(stripe_credit_note_command, '{params,credit_amount}', '9000') WHERE idempotency_key = 'command:first'$$,
  '23514', 'A saved Stripe credit note command and request timestamp are immutable',
  'a paid-invoice retry cannot add credit_amount to an open-invoice request'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = NULL, stripe_credit_note_requested_at = NULL WHERE idempotency_key = 'command:first'$$,
  '23514', 'A saved Stripe credit note command and request timestamp are immutable',
  'the saved request cannot be cleared to rebuild it'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_requested_at = NULL WHERE idempotency_key = 'command:first'$$,
  '23514', 'A saved Stripe credit note command and request timestamp are immutable',
  'the saved request timestamp cannot be cleared'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_requested_at = stripe_credit_note_requested_at + interval '1 hour' WHERE idempotency_key = 'command:first'$$,
  '23514', 'A saved Stripe credit note command and request timestamp are immutable',
  'a retry cannot extend its safe replay window'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET idempotency_key = 'command:replacement' WHERE idempotency_key = 'command:first'$$,
  '23514', 'new row for relation "session_billing_adjustments" violates check constraint "session_billing_credit_note_command_shape"',
  'changing the durable key cannot detach it from the saved request'
);
SELECT lives_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = stripe_credit_note_command, reason_note = 'Revalidated immediately before applying the financial adjustment', status = 'retryable' WHERE idempotency_key = 'command:first'$$,
  'reconciliation metadata and status may change with an unchanged request'
);

UPDATE public.sessions_students SET planned_absence = false, is_credited = false
WHERE id = (SELECT sessions_students_id FROM credit_command_fixture);
SELECT is(
  public.enqueue_session_billing_adjustment(
    (SELECT sessions_students_id FROM credit_command_fixture), NULL, 'system_reconciliation', 'Attendance corrected'
  ),
  NULL::uuid,
  'the updated chargeable obligation needs no new credit before the lost response is recovered'
);
SELECT is(
  (SELECT status::text FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  'retryable',
  'reconciliation cannot supersede a request which may already have reached Stripe'
);
SELECT is(
  (SELECT stripe_credit_note_command FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  pg_temp.credit_command('command:first'),
  'changed attendance preserves the prepared request for recovery'
);

CREATE TEMP TABLE retried_credit_command AS
SELECT * FROM public.claim_session_billing_adjustments_by_ids(
  ARRAY['fa300000-0000-4000-8000-000000000001'::uuid], 1
);
SELECT is(
  (SELECT attempt_count FROM retried_credit_command), 2,
  'ordinary claiming still advances a retry attempt'
);
SELECT is(
  (SELECT stripe_credit_note_command FROM retried_credit_command),
  pg_temp.credit_command('command:first'),
  'claiming returns the original request despite reconciliation metadata changes'
);
SELECT lives_ok(
  $$SELECT public.fail_session_billing_adjustment('fa300000-0000-4000-8000-000000000001', 'Temporary Stripe outage')$$,
  'ordinary failure recording remains compatible with saved requests'
);

UPDATE public.sessions_students SET planned_absence = true, is_credited = true
WHERE id = (SELECT sessions_students_id FROM credit_command_fixture);
SELECT isnt(
  public.enqueue_session_billing_adjustment(
    (SELECT sessions_students_id FROM credit_command_fixture), NULL, 'system_reconciliation', 'New obligation'
  ),
  NULL::uuid,
  'a newly selected obligation follows the enqueue replacement branch'
);
SELECT is(
  (SELECT status::text FROM public.session_billing_adjustments WHERE idempotency_key = 'command:first'),
  'retryable',
  'selecting a newer obligation also preserves an unresolved Stripe request'
);

UPDATE public.session_billing_adjustments
SET status = 'failed', completed_at = now(), last_error = 'Terminal Stripe validation failure'
WHERE idempotency_key = 'command:first';

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category,
  idempotency_key, depends_on_adjustment_id
)
SELECT
  'fa300000-0000-4000-8000-000000000005', sessions_students_id,
  'session_charge', 'pending', 'system_reconciliation', 'command:dependent',
  'fa300000-0000-4000-8000-000000000001'
FROM credit_command_fixture;

SELECT is(
  (SELECT count(*)::integer FROM public.claim_session_billing_adjustments_by_ids(
    ARRAY['fa300000-0000-4000-8000-000000000005'::uuid], 1
  )),
  0,
  'a terminal credit failure does not unlock the replacement charge'
);
SELECT is(
  (SELECT issue FROM public.vadmin_reconciliation_session_billing_adjustments
   WHERE adjustment_id = 'fa300000-0000-4000-8000-000000000005'),
  'blocked_by_failed_dependency',
  'the blocked replacement remains visible for reconciliation'
);

SELECT is(
  (SELECT stripe_credit_note_request_version::integer FROM public.session_billing_adjustments WHERE idempotency_key = 'command:dependent'),
  NULL::integer,
  'new rows do not assume an old worker implements save-before-send'
);
UPDATE public.session_billing_adjustments SET attempt_count = 1 WHERE idempotency_key = 'command:new-retry';
UPDATE public.session_billing_adjustments SET stripe_credit_note_request_version = 1 WHERE idempotency_key = 'command:new-retry';
UPDATE public.session_billing_adjustments SET attempt_count = 2 WHERE idempotency_key = 'command:new-retry';

SELECT lives_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_command = pg_temp.credit_command('command:new-retry') WHERE idempotency_key = 'command:new-retry'$$,
  'new protocol work may save after an earlier attempt failed before contacting Stripe'
);
SELECT is(
  (SELECT stripe_credit_note_requested_at FROM public.session_billing_adjustments WHERE idempotency_key = 'command:new-retry'),
  now(),
  'a preparation retry starts the replay window only when its request is saved'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_request_version = NULL WHERE idempotency_key = 'command:first'$$,
  '23514', 'The Stripe credit note request protocol version is immutable',
  'the request protocol marker cannot be cleared'
);
SELECT throws_ok(
  $$UPDATE public.session_billing_adjustments SET stripe_credit_note_request_version = 1 WHERE idempotency_key = 'command:legacy'$$,
  '23514', 'The Stripe credit note request protocol requires a first processing attempt',
  'unknown legacy requests cannot be relabelled as safely replayable'
);

SELECT * FROM finish();
ROLLBACK;
