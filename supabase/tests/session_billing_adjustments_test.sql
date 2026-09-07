BEGIN;

SELECT plan(42);

SELECT is(
  private.session_billing_cutoff_at('2026-07-13 06:30:00+00'::timestamptz),
  '2026-07-12 11:30:00+00'::timestamptz,
  'the billing cutoff is 9pm Adelaide on the previous winter day'
);

SELECT is(
  private.session_billing_cutoff_at('2026-01-13 05:30:00+00'::timestamptz),
  '2026-01-12 10:30:00+00'::timestamptz,
  'the billing cutoff is 9pm Adelaide on the previous summer day'
);

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
  'f0000000-0000-4000-8000-000000000020',
  source.type,
  source.subject_id,
  '2099-01-13 05:30:00+00'::timestamptz,
  '2099-01-13 07:00:00+00'::timestamptz,
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
  'f0000000-0000-4000-8000-000000000021',
  'f0000000-0000-4000-8000-000000000020',
  '10000000-0000-0000-0000-000000000001',
  false,
  false,
  false,
  false
);

CREATE TEMP TABLE future_session_charge AS
SELECT public.enqueue_session_billing_adjustment(
  'f0000000-0000-4000-8000-000000000021',
  NULL,
  'system_reconciliation',
  'cutoff test'
) AS adjustment_id;

SELECT is(
  (
    SELECT next_attempt_at
    FROM public.session_billing_adjustments
    WHERE id = (SELECT adjustment_id FROM future_session_charge)
  ),
  '2099-01-12 10:30:00+00'::timestamptz,
  'a future replacement charge waits for the normal Adelaide billing cutoff'
);

SELECT is(
  public.get_chargeable_sessions_students_ids(
    ARRAY[(SELECT sessions_students_id FROM billing_adjustment_fixture)]
  ),
  ARRAY[(SELECT sessions_students_id FROM billing_adjustment_fixture)],
  'batch chargeability includes an ordinary billable attendance'
);

UPDATE public.sessions_students ss
SET was_trial = true
FROM billing_adjustment_fixture fixture
WHERE ss.id = fixture.sessions_students_id;

SELECT is(
  public.get_chargeable_sessions_students_ids(
    ARRAY[(SELECT sessions_students_id FROM billing_adjustment_fixture)]
  ),
  ARRAY[]::uuid[],
  'batch chargeability excludes a trial attendance in a billable session'
);

UPDATE public.sessions_students ss
SET was_trial = false
FROM billing_adjustment_fixture fixture
WHERE ss.id = fixture.sessions_students_id;

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

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.get_chargeable_sessions_students_ids(uuid[])',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot call the batch chargeability helper'
);

SELECT is(
  has_function_privilege(
    'service_role',
    'public.get_chargeable_sessions_students_ids(uuid[])',
    'EXECUTE'
  ),
  true,
  'the billing worker can call the batch chargeability helper'
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

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key,
  next_attempt_at
)
VALUES
  (
    'f5000000-0000-4000-8000-000000000004',
    (SELECT sessions_students_id FROM billing_adjustment_fixture),
    'session_charge',
    'pending',
    'system_reconciliation',
    'test:future-pending',
    now() + interval '1 day'
  ),
  (
    'f5000000-0000-4000-8000-000000000005',
    (SELECT sessions_students_id FROM billing_adjustment_fixture),
    'session_charge',
    'retryable',
    'system_reconciliation',
    'test:future-retryable',
    now() + interval '1 day'
  ),
  (
    'f5000000-0000-4000-8000-000000000006',
    (SELECT sessions_students_id FROM billing_adjustment_fixture),
    'session_charge',
    'pending',
    'system_reconciliation',
    'test:targeted-due',
    now() - interval '1 minute'
  ),
  (
    'f5000000-0000-4000-8000-000000000007',
    (SELECT sessions_students_id FROM billing_adjustment_fixture),
    'session_charge',
    'pending',
    'system_reconciliation',
    'test:unrelated-due',
    now() - interval '1 minute'
  );

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.vadmin_reconciliation_session_billing_adjustments
    WHERE adjustment_id = 'f5000000-0000-4000-8000-000000000004'
  ),
  0,
  'normal future-pending work is hidden from Financial reconciliation'
);

SELECT is(
  (
    SELECT issue
    FROM public.vadmin_reconciliation_session_billing_adjustments
    WHERE adjustment_id = 'f5000000-0000-4000-8000-000000000005'
  ),
  'retryable_adjustment',
  'retryable work remains visible during its backoff window'
);

CREATE TEMP TABLE targeted_claimed_adjustments AS
SELECT * FROM public.claim_session_billing_adjustments_by_ids(
  ARRAY['f5000000-0000-4000-8000-000000000006'::uuid],
  25
);

SELECT is(
  (SELECT count(*)::integer FROM targeted_claimed_adjustments),
  1,
  'targeted claiming returns the requested due adjustment'
);

SELECT is(
  (
    SELECT status::text
    FROM public.session_billing_adjustments
    WHERE id = 'f5000000-0000-4000-8000-000000000006'
  ),
  'processing',
  'targeted claiming leases the requested adjustment'
);

SELECT is(
  (
    SELECT status::text
    FROM public.session_billing_adjustments
    WHERE id = 'f5000000-0000-4000-8000-000000000007'
  ),
  'pending',
  'targeted claiming leaves unrelated due adjustments untouched'
);

SELECT is(
  has_function_privilege(
    'authenticated',
    'public.claim_session_billing_adjustments_by_ids(uuid[],integer)',
    'EXECUTE'
  ),
  false,
  'authenticated clients cannot directly claim targeted billing work'
);

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key,
  next_attempt_at
)
VALUES (
  'f5000000-0000-4000-8000-000000000008',
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  'session_charge',
  'pending',
  'system_reconciliation',
  'test:immediate-credit-pass',
  now() - interval '1 minute'
);

INSERT INTO public.session_billing_adjustments (
  id, sessions_students_id, kind, status, reason_category, idempotency_key,
  next_attempt_at, depends_on_adjustment_id
)
VALUES (
  'f5000000-0000-4000-8000-000000000009',
  (SELECT sessions_students_id FROM billing_adjustment_fixture),
  'session_charge',
  'pending',
  'system_reconciliation',
  'test:immediate-dependent-pass',
  now() - interval '1 minute',
  'f5000000-0000-4000-8000-000000000008'
);

CREATE TEMP TABLE first_dependency_pass AS
SELECT * FROM public.claim_session_billing_adjustments_by_ids(
  ARRAY[
    'f5000000-0000-4000-8000-000000000008'::uuid,
    'f5000000-0000-4000-8000-000000000009'::uuid
  ],
  25
);

SELECT is(
  (SELECT count(*)::integer FROM first_dependency_pass),
  1,
  'the first immediate pass claims only the ready prerequisite'
);

SELECT is(
  (SELECT id FROM first_dependency_pass),
  'f5000000-0000-4000-8000-000000000008'::uuid,
  'the dependent adjustment waits for prerequisite success'
);

UPDATE public.session_billing_adjustments
SET status = 'succeeded', completed_at = now()
WHERE id = 'f5000000-0000-4000-8000-000000000008';

CREATE TEMP TABLE second_dependency_pass AS
SELECT * FROM public.claim_session_billing_adjustments_by_ids(
  ARRAY[
    'f5000000-0000-4000-8000-000000000008'::uuid,
    'f5000000-0000-4000-8000-000000000009'::uuid
  ],
  25
);

SELECT is(
  (SELECT id FROM second_dependency_pass),
  'f5000000-0000-4000-8000-000000000009'::uuid,
  'a later immediate pass claims the newly unblocked dependent adjustment'
);

INSERT INTO public.sessions (
  id, type, subject_id, start_at, end_at, status, billing_type
)
SELECT
  'f0000000-0000-4000-8000-000000000010',
  source.type,
  source.subject_id,
  now() + interval '2 days',
  now() + interval '2 days 90 minutes',
  'ACTIVE',
  source.billing_type
FROM public.sessions source
WHERE source.billing_type IS NOT NULL
LIMIT 1;

INSERT INTO public.sessions_students (
  id, session_id, student_id, planned_absence, is_credited, is_rescheduled, was_trial
)
VALUES (
  'f0000000-0000-4000-8000-000000000011',
  'f0000000-0000-4000-8000-000000000010',
  '10000000-0000-0000-0000-000000000001',
  false, false, false, false
);

INSERT INTO public.invoices (
  id, student_id, stripe_invoice_id, invoice_date, amount_due_cents,
  amount_paid_cents, currency, status
)
VALUES (
  'f1000000-0000-4000-8000-000000000010',
  '10000000-0000-0000-0000-000000000001',
  'in_immediate_adjustment_test',
  CURRENT_DATE,
  9000,
  9000,
  'AUD',
  'paid'
);

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_subsidy, is_fee, line_kind, session_id, student_id
)
VALUES (
  'f2000000-0000-4000-8000-000000000010',
  'f1000000-0000-4000-8000-000000000010',
  'f0000000-0000-4000-8000-000000000011',
  'ii_immediate_adjustment_test',
  9000,
  'Immediate adjustment command test',
  false,
  false,
  'session_charge',
  'f0000000-0000-4000-8000-000000000010',
  '10000000-0000-0000-0000-000000000001'
);

CREATE TEMP TABLE logged_absence_command AS
SELECT public.log_student_absences_with_billing(
  jsonb_build_array(jsonb_build_object(
    'student_id', '10000000-0000-0000-0000-000000000001',
    'original_sessions_students_id', 'f0000000-0000-4000-8000-000000000011',
    'action', 'credit'
  )),
  '00000000-0000-0000-0000-000000000001',
  'approved_absence',
  'immediate command test'
) AS result;

SELECT is(
  (SELECT jsonb_array_length(result->'billing_adjustment_ids') FROM logged_absence_command),
  1,
  'the absence command returns the exact adjustment IDs it enqueued'
);

SELECT is(
  (
    SELECT adjustment.kind::text
    FROM logged_absence_command command
    JOIN public.session_billing_adjustments adjustment
      ON adjustment.id = (command.result->'billing_adjustment_ids'->>0)::uuid
  ),
  'credit_note',
  'the returned adjustment ID identifies the absence credit work'
);

SELECT * FROM finish();

ROLLBACK;
