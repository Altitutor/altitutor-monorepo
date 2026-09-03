BEGIN;

SELECT plan(24);

SELECT is(
  public.derive_session_absence_billing_treatment(false, false, false),
  'none',
  'a session without a planned absence has no absence billing treatment'
);

SELECT is(
  public.derive_session_absence_billing_treatment(true, false, false),
  'charge',
  'a planned absence with no relief remains chargeable'
);

SELECT is(
  public.derive_session_absence_billing_treatment(true, true, false),
  'credit',
  'the legacy credited flag maps to credit treatment'
);

SELECT throws_ok(
  $$SELECT public.derive_session_absence_billing_treatment(true, true, true)$$,
  '23514',
  'A session cannot be both credited and rescheduled',
  'invalid legacy treatment combinations fail closed'
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
  'f0000000-0000-4000-8000-000000000001',
  source.type,
  source.subject_id,
  now() - interval '2 days',
  now() - interval '2 days' + interval '90 minutes',
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
)
VALUES (
  'f0000000-0000-4000-8000-000000000002',
  'f0000000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  false,
  false,
  false,
  false
);

CREATE TEMP TABLE billing_adjustment_fixture AS
SELECT
  'f0000000-0000-4000-8000-000000000002'::uuid AS sessions_students_id,
  '10000000-0000-0000-0000-000000000001'::uuid AS student_id,
  'f0000000-0000-4000-8000-000000000001'::uuid AS session_id;

UPDATE public.sessions_students ss
SET
  planned_absence = true,
  is_credited = true,
  is_rescheduled = false
FROM billing_adjustment_fixture fixture
WHERE ss.id = fixture.sessions_students_id;

INSERT INTO public.invoices (
  id,
  student_id,
  stripe_invoice_id,
  invoice_date,
  amount_due_cents,
  amount_paid_cents,
  currency,
  status
)
SELECT
  'f1000000-0000-4000-8000-000000000001',
  fixture.student_id,
  'in_adjustment_test',
  CURRENT_DATE,
  9200,
  9200,
  'AUD',
  'paid'
FROM billing_adjustment_fixture fixture;

INSERT INTO public.invoice_items (
  id,
  invoice_id,
  sessions_students_id,
  stripe_invoice_item_id,
  amount_cents,
  description,
  is_subsidy,
  is_fee,
  session_id,
  student_id
)
SELECT
  'f2000000-0000-4000-8000-000000000002',
  'f1000000-0000-4000-8000-000000000001',
  fixture.sessions_students_id,
  'ii_adjustment_fee_test',
  200,
  'Legacy processing fee',
  false,
  true,
  fixture.session_id,
  fixture.student_id
FROM billing_adjustment_fixture fixture;

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
)
SELECT
  'f2000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  fixture.sessions_students_id,
  'ii_adjustment_test',
  9000,
  'Session billing adjustment test',
  false,
  false,
  'session_charge',
  fixture.session_id,
  fixture.student_id
FROM billing_adjustment_fixture fixture;

SELECT is(
  public.session_student_is_chargeable(
    (SELECT sessions_students_id FROM billing_adjustment_fixture)
  ),
  false,
  'a credited planned absence is not chargeable'
);

CREATE TEMP TABLE enqueued_credit AS
SELECT public.enqueue_session_billing_adjustment(
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  NULL,
  'approved_absence',
  'test credit'
) AS adjustment_id;

SELECT is(
  (
    SELECT kind::text
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_credit)
  ),
  'credit_note',
  'an already invoiced credited absence queues a line-level credit note'
);

SELECT is(
  (
    SELECT source_invoice_item_id
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_credit)
  ),
  'f2000000-0000-4000-8000-000000000001'::uuid,
  'the credit adjustment identifies the original invoice line'
);

SELECT is(
  (
    SELECT amount_cents
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_credit)
  ),
  9200,
  'the credit includes an attributable legacy processing fee'
);

SELECT is(
  public.enqueue_session_billing_adjustment(
    (SELECT sessions_students_id FROM billing_adjustment_fixture),
    NULL,
    'approved_absence',
    'retry of the same intent'
  ),
  (SELECT adjustment_id FROM enqueued_credit),
  'enqueueing the same financial intent is idempotent'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.session_billing_adjustments
    WHERE sessions_students_id = (SELECT sessions_students_id FROM billing_adjustment_fixture)
      AND kind = 'credit_note'
      AND status <> 'superseded'
  ),
  1,
  'only one current credit adjustment exists for a source line'
);

UPDATE public.session_billing_adjustments
SET status = 'succeeded', completed_at = now()
WHERE id = (SELECT adjustment_id FROM enqueued_credit);

INSERT INTO public.credit_notes (
  id,
  invoice_id,
  stripe_credit_note_id,
  amount_cents,
  currency,
  reason,
  status,
  source_invoice_item_id,
  billing_adjustment_id
)
VALUES (
  'f3000000-0000-4000-8000-000000000001',
  'f1000000-0000-4000-8000-000000000001',
  'cn_adjustment_test',
  9200,
  'AUD',
  'approved absence',
  'issued',
  'f2000000-0000-4000-8000-000000000001',
  (SELECT adjustment_id FROM enqueued_credit)
);

INSERT INTO public.tutor_logs (id, session_id, created_by, session_type)
SELECT
  'f4000000-0000-4000-8000-000000000001',
  fixture.session_id,
  '00000000-0000-0000-0000-000000000001',
  sessions.type
FROM billing_adjustment_fixture fixture
JOIN public.sessions ON sessions.id = fixture.session_id;

INSERT INTO public.tutor_logs_student_attendance (
  tutor_log_id,
  student_id,
  attended,
  was_trial,
  created_by
)
SELECT
  'f4000000-0000-4000-8000-000000000001',
  fixture.student_id,
  true,
  false,
  '00000000-0000-0000-0000-000000000001'
FROM billing_adjustment_fixture fixture;

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.session_billing_adjustments
    WHERE sessions_students_id = (SELECT sessions_students_id FROM billing_adjustment_fixture)
      AND kind = 'restoration_charge'
      AND status = 'pending'
  ),
  1,
  'attendance logging immediately queues restoration without a special UI path'
);

SELECT is(
  public.session_student_is_chargeable(
    (SELECT sessions_students_id FROM billing_adjustment_fixture)
  ),
  true,
  'actual attendance overrides an earlier credited absence'
);

CREATE TEMP TABLE enqueued_restoration AS
SELECT public.enqueue_session_billing_adjustment(
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  NULL,
  'attendance_correction',
  'student attended after credit'
) AS adjustment_id;

SELECT is(
  (
    SELECT kind::text
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_restoration)
  ),
  'restoration_charge',
  'attendance after a successful credit queues an append-only restoration charge'
);

SELECT is(
  (
    SELECT source_credit_note_id
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_restoration)
  ),
  'f3000000-0000-4000-8000-000000000001'::uuid,
  'the restoration is linked to the credit it restores'
);

SELECT is(
  (
    SELECT amount_cents
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM enqueued_restoration)
  ),
  9000,
  'the restoration excludes the previously credited processing fee'
);

UPDATE public.session_billing_adjustments
SET status = 'succeeded', completed_at = now()
WHERE id = (SELECT adjustment_id FROM enqueued_restoration);

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_subsidy, is_fee, line_kind, restores_credit_note_id,
  billing_adjustment_id, session_id, student_id
)
SELECT
  'f2000000-0000-4000-8000-000000000003',
  'f1000000-0000-4000-8000-000000000001',
  fixture.sessions_students_id,
  'ii_adjustment_restoration_test',
  9000,
  'Restored session charge',
  false,
  false,
  'restoration_charge',
  'f3000000-0000-4000-8000-000000000001',
  (SELECT adjustment_id FROM enqueued_restoration),
  fixture.session_id,
  fixture.student_id
FROM billing_adjustment_fixture fixture;

UPDATE public.tutor_logs_student_attendance
SET attended = false
WHERE tutor_log_id = 'f4000000-0000-4000-8000-000000000001'
  AND student_id = (SELECT student_id FROM billing_adjustment_fixture);

CREATE TEMP TABLE repeated_credit AS
SELECT id AS adjustment_id
FROM public.session_billing_adjustments
WHERE sessions_students_id = (SELECT sessions_students_id FROM billing_adjustment_fixture)
  AND kind = 'credit_note'
  AND source_invoice_item_id = 'f2000000-0000-4000-8000-000000000003';

SELECT is(
  (SELECT count(*)::integer FROM repeated_credit),
  1,
  'a second absence after restoration queues another append-only credit'
);

SELECT is(
  (
    SELECT source_invoice_item_id
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM repeated_credit)
  ),
  'f2000000-0000-4000-8000-000000000003'::uuid,
  'the repeated credit targets the restoration rather than the original line'
);

SELECT is(
  (
    SELECT amount_cents
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM repeated_credit)
  ),
  9000,
  'a repeated credit does not credit the legacy processing fee twice'
);

UPDATE public.session_billing_adjustments
SET
  status = 'failed',
  last_error = 'Stripe request failed',
  attempt_count = max_attempts
WHERE id = (SELECT adjustment_id FROM repeated_credit);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.vadmin_reconciliation_session_billing_adjustments
    WHERE adjustment_id = (SELECT adjustment_id FROM repeated_credit)
      AND issue = 'failed_adjustment'
  ),
  1,
  'terminal failures are visible in Financial reconciliation'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.enqueue_session_billing_adjustment(uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot call the internal adjustment queue directly'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.log_student_absences(jsonb,uuid)',
    'EXECUTE'
  ),
  false,
  'the legacy absence RPC cannot bypass the billing-aware wrapper'
);

SELECT is(
  has_function_privilege(
    'service_role',
    'public.enqueue_session_billing_adjustment(uuid,uuid,text,text,uuid)',
    'EXECUTE'
  ),
  true,
  'the billing worker can execute the internal adjustment queue'
);

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key, updated_at
)
VALUES (
  'f5000000-0000-4000-8000-000000000001',
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  'session_charge',
  'processing',
  'system_reconciliation',
  'test:stale-processing',
  now() - interval '31 minutes'
);

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key
)
VALUES (
  'f5000000-0000-4000-8000-000000000002',
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  'session_charge',
  'superseded',
  'system_reconciliation',
  'test:superseded-dependency'
);

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key,
  depends_on_adjustment_id
)
VALUES (
  'f5000000-0000-4000-8000-000000000003',
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  'session_charge',
  'pending',
  'system_reconciliation',
  'test:dependent-charge',
  'f5000000-0000-4000-8000-000000000002'
);

CREATE TEMP TABLE claimed_adjustments AS
SELECT * FROM public.claim_session_billing_adjustments(25);

SELECT is(
  (
    SELECT attempt_count
    FROM claimed_adjustments
    WHERE id = 'f5000000-0000-4000-8000-000000000001'
  ),
  1,
  'a crashed processing adjustment is reclaimed after its lease expires'
);

SELECT is(
  (
    SELECT status::text
    FROM claimed_adjustments
    WHERE id = 'f5000000-0000-4000-8000-000000000003'
  ),
  'processing',
  'a dependent charge proceeds when its prerequisite is safely superseded'
);

SELECT * FROM finish();

ROLLBACK;
