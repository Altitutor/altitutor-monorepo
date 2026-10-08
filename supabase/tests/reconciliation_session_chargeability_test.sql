BEGIN;
SELECT no_plan();

-- Exercise the actual dashboard views against the billing worker's decision.
CREATE TEMP TABLE reconciliation_fixture (
  scenario text PRIMARY KEY,
  session_id uuid NOT NULL,
  assignment_id uuid NOT NULL,
  expected boolean NOT NULL
);
INSERT INTO reconciliation_fixture
SELECT scenario, md5('reconciliation-session-' || scenario)::uuid,
  md5('reconciliation-assignment-' || scenario)::uuid, expected
FROM (VALUES
  ('active', true),
  ('inactive', false),
  ('calendar_tombstone', false),
  ('inactive_attended', false),
  ('assignment_trial', false),
  ('attendance_trial', false),
  ('charge_absence', true),
  ('credit_absence', false),
  ('replacement_absence', false),
  ('credit_attended', true),
  ('pending_adjustment', false),
  ('future', false),
  ('nonbillable', false)
) AS scenarios(scenario, expected);

INSERT INTO public.sessions (
  id, type, subject_id, start_at, end_at, status, billing_type,
  calendar_tombstone_until
)
SELECT fixture.session_id,
  CASE WHEN fixture.scenario = 'nonbillable' THEN 'CHECK_IN'::public.session_type ELSE source.type END,
  source.subject_id,
  now() + CASE WHEN fixture.scenario = 'future' THEN interval '2 days' ELSE interval '-2 days' END,
  now() + CASE WHEN fixture.scenario = 'future' THEN interval '2 days' ELSE interval '-2 days' END + interval '90 minutes',
  CASE WHEN fixture.scenario = 'inactive' THEN 'INACTIVE' ELSE 'ACTIVE' END,
  CASE WHEN fixture.scenario = 'nonbillable' THEN NULL ELSE source.billing_type END,
  CASE WHEN fixture.scenario = 'calendar_tombstone' THEN now() + interval '90 days' END
FROM reconciliation_fixture fixture
CROSS JOIN LATERAL (
  SELECT type, subject_id, billing_type FROM public.sessions
  WHERE billing_type IS NOT NULL LIMIT 1
) source;

INSERT INTO public.sessions_students (
  id, session_id, student_id, planned_absence, is_credited, is_rescheduled, was_trial
)
SELECT assignment_id, session_id, '10000000-0000-0000-0000-000000000001',
  scenario IN ('charge_absence', 'credit_absence', 'replacement_absence', 'credit_attended'),
  scenario IN ('credit_absence', 'credit_attended'),
  scenario = 'replacement_absence', scenario = 'assignment_trial'
FROM reconciliation_fixture;

UPDATE public.sessions_students SET was_trial = true
WHERE id = md5('reconciliation-assignment-assignment_trial')::uuid;

INSERT INTO public.sessions_staff (session_id, staff_id, type)
SELECT session_id, '00000000-0000-0000-0000-000000000001', 'MAIN_TUTOR'
FROM reconciliation_fixture
WHERE scenario IN ('inactive_attended', 'attendance_trial', 'credit_attended');

INSERT INTO public.tutor_logs (id, session_id, created_by, logged_for_staff_id, session_type)
SELECT md5('reconciliation-log-' || fixture.scenario)::uuid, fixture.session_id,
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001', session.type
FROM reconciliation_fixture fixture
JOIN public.sessions session ON session.id = fixture.session_id
WHERE fixture.scenario IN ('inactive_attended', 'attendance_trial', 'credit_attended');
INSERT INTO public.tutor_logs_student_attendance (tutor_log_id, student_id, attended, was_trial, created_by)
SELECT md5('reconciliation-log-' || scenario)::uuid,
  '10000000-0000-0000-0000-000000000001', true,
  scenario = 'attendance_trial', '00000000-0000-0000-0000-000000000001'
FROM reconciliation_fixture
WHERE scenario IN ('inactive_attended', 'attendance_trial', 'credit_attended');

-- Existing logs may predate cancellation. New logs on cancelled sessions are blocked.
UPDATE public.sessions SET status = 'INACTIVE', calendar_tombstone_until = now() + interval '90 days'
WHERE id = md5('reconciliation-session-inactive_attended')::uuid;

UPDATE public.tutor_logs_student_attendance SET was_trial = true
WHERE tutor_log_id = md5('reconciliation-log-attendance_trial')::uuid;

-- Attendance triggers legitimately queue work. Resolve fixture work except for
-- the explicit pending-adjustment case so both routing paths are tested.
UPDATE public.session_billing_adjustments SET status = 'superseded'
WHERE sessions_students_id IN (SELECT assignment_id FROM reconciliation_fixture);
INSERT INTO public.session_billing_adjustments (
  sessions_students_id, kind, status, reason_category, idempotency_key
)
SELECT assignment_id, 'session_charge', 'pending', 'system_reconciliation',
  'reconciliation-pending-adjustment'
FROM reconciliation_fixture WHERE scenario = 'pending_adjustment';

SELECT is((SELECT count(*)::integer FROM public.session_billing_adjustments
           WHERE idempotency_key = 'reconciliation-pending-adjustment' AND status = 'pending'),
  1, 'unresolved billing-adjustment fixture is present');

SELECT is(
  EXISTS (SELECT 1 FROM public.vadmin_reconciliation_uninvoiced_sessions view
          WHERE view.sessions_students_id = fixture.assignment_id),
  fixture.expected, 'uninvoiced queue: ' || fixture.scenario
)
FROM reconciliation_fixture fixture ORDER BY scenario;

SELECT is(
  public.session_student_is_chargeable(assignment_id), expected,
  'dashboard agrees with canonical chargeability: ' || scenario
)
FROM reconciliation_fixture
WHERE scenario NOT IN ('pending_adjustment', 'future') ORDER BY scenario;

INSERT INTO public.invoices (id, student_id, stripe_invoice_id, invoice_date, amount_due_cents, amount_paid_cents, status)
SELECT md5('reconciliation-invoice-' || scenario)::uuid,
  '10000000-0000-0000-0000-000000000001', 'in_reconciliation_' || scenario,
  CURRENT_DATE, 9000, 0, 'void'
FROM reconciliation_fixture;
INSERT INTO public.invoice_items (
  invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_fee, line_kind, session_id, student_id
)
SELECT md5('reconciliation-invoice-' || scenario)::uuid, assignment_id,
  'ii_reconciliation_' || scenario, 9000, 'Reconciliation eligibility test',
  false, 'session_charge', session_id, '10000000-0000-0000-0000-000000000001'
FROM reconciliation_fixture;

SELECT is(
  EXISTS (SELECT 1 FROM public.vadmin_reconciliation_void_invoice_sessions view
          WHERE view.sessions_students_id = fixture.assignment_id),
  fixture.expected, 'void-invoice queue: ' || fixture.scenario
)
FROM reconciliation_fixture fixture ORDER BY scenario;

SELECT is(
  (SELECT count(*)::integer FROM public.vadmin_reconciliation_uninvoiced_sessions view
   JOIN reconciliation_fixture fixture ON fixture.assignment_id = view.sessions_students_id),
  0, 'void-only invoice rows are routed separately from uninvoiced sessions'
);

UPDATE public.invoices SET status = 'open'
WHERE id = md5('reconciliation-invoice-active')::uuid;
SELECT is(
  EXISTS (SELECT 1 FROM public.vadmin_reconciliation_void_invoice_sessions
          WHERE sessions_students_id = md5('reconciliation-assignment-active')::uuid),
  false, 'an active invoice removes a session from re-invoicing'
);
UPDATE public.invoice_items SET deleted_at = now()
WHERE sessions_students_id = md5('reconciliation-assignment-active')::uuid;
SELECT is(
  EXISTS (SELECT 1 FROM public.vadmin_reconciliation_uninvoiced_sessions
          WHERE sessions_students_id = md5('reconciliation-assignment-active')::uuid),
  true, 'deleted invoice lines do not block a chargeable session'
);

GRANT SELECT ON reconciliation_fixture TO authenticated;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is(
  (SELECT count(*)::integer FROM public.vadmin_reconciliation_uninvoiced_sessions view
   JOIN reconciliation_fixture fixture ON fixture.assignment_id = view.sessions_students_id),
  1, 'active admin can query the uninvoiced queue'
);
SELECT is(
  (SELECT count(*)::integer FROM public.vadmin_reconciliation_void_invoice_sessions view
   JOIN reconciliation_fixture fixture ON fixture.assignment_id = view.sessions_students_id),
  2, 'active admin can query the void-invoice queue'
);
SELECT is(has_function_privilege('authenticated', 'public.session_student_is_chargeable(uuid)', 'EXECUTE'),
  false, 'service-only billing RPC retains its access boundary');
SELECT set_config('request.jwt.claims', '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT is((SELECT count(*)::integer FROM public.vadmin_reconciliation_uninvoiced_sessions),
  0, 'student cannot read admin uninvoiced records');
SELECT is((SELECT count(*)::integer FROM public.vadmin_reconciliation_void_invoice_sessions),
  0, 'student cannot read admin void-invoice records');
RESET ROLE;

SELECT is(has_function_privilege('anon',
  'public.session_billing_obligation_is_chargeable(boolean, public.billing_type, boolean, boolean, boolean, boolean, text)',
  'EXECUTE'), false, 'anonymous callers cannot execute the shared policy');
SELECT is(has_table_privilege('anon', 'public.vadmin_reconciliation_uninvoiced_sessions', 'SELECT'),
  false, 'anonymous callers cannot read the uninvoiced view');
SELECT is(has_table_privilege('anon', 'public.vadmin_reconciliation_void_invoice_sessions', 'SELECT'),
  false, 'anonymous callers cannot read the void-invoice view');
SELECT is((SELECT prosecdef FROM pg_proc WHERE oid =
  'public.session_billing_obligation_is_chargeable(boolean, public.billing_type, boolean, boolean, boolean, boolean, text)'::regprocedure),
  false, 'the value-only policy grants no definer privileges');

-- A genuinely held lesson can be restored without changing cancellation's
-- precedence globally or discarding its existing attendance history.
UPDATE public.sessions SET status = 'ACTIVE', calendar_tombstone_until = NULL,
  is_schedule_exception = true
WHERE id = md5('reconciliation-session-inactive_attended')::uuid;
SELECT is(public.session_student_is_chargeable(md5('reconciliation-assignment-inactive_attended')::uuid),
  true, 'restoring a held lesson makes its non-trial attendance billable');
SELECT is(EXISTS (SELECT 1 FROM public.vadmin_reconciliation_void_invoice_sessions
                 WHERE sessions_students_id = md5('reconciliation-assignment-inactive_attended')::uuid),
  true, 'restored held lesson returns to the appropriate invoicing queue');

SELECT * FROM finish();
ROLLBACK;
