BEGIN;

SELECT plan(3);

SELECT set_config('app.class_schedule_apply', 'true', true);

INSERT INTO public.sessions (
  id, class_id, subject_id, type, start_at, end_at, status, billing_type
)
SELECT
  'fa100000-0000-4000-8000-000000000001',
  class_id,
  subject_id,
  type,
  now() + interval '2 days',
  now() + interval '2 days 90 minutes',
  'ACTIVE',
  billing_type
FROM public.sessions
WHERE subject_id IS NOT NULL
  AND billing_type IS NOT NULL
  AND type <> 'TRIAL_SESSION'
LIMIT 1;

INSERT INTO public.sessions (
  id, class_id, subject_id, type, start_at, end_at, status, billing_type
)
SELECT
  'fa100000-0000-4000-8000-000000000002',
  class_id,
  subject_id,
  type,
  now() + interval '9 days',
  now() + interval '9 days 90 minutes',
  'ACTIVE',
  billing_type
FROM public.sessions
WHERE id = 'fa100000-0000-4000-8000-000000000001';

SELECT set_config('app.class_schedule_apply', 'false', true);

INSERT INTO public.sessions_students (
  id, session_id, student_id, planned_absence, is_credited, is_rescheduled, was_trial
) VALUES (
  'fb100000-0000-4000-8000-000000000001',
  'fa100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  false,
  false,
  false,
  false
);

INSERT INTO public.invoices (
  id, student_id, stripe_invoice_id, invoice_date, amount_due_cents,
  amount_paid_cents, currency, status, billing_source
) VALUES (
  'fc100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'in_student_absence_guard_repro',
  '2100-01-01',
  9000,
  9000,
  'AUD',
  'paid',
  'session_runner'
);

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_subsidy, is_fee, line_kind, session_id, student_id
) VALUES (
  'fd100000-0000-4000-8000-000000000001',
  'fc100000-0000-4000-8000-000000000001',
  'fb100000-0000-4000-8000-000000000001',
  'ii_student_absence_guard_repro',
  9000,
  'Student absence guard regression',
  false,
  false,
  'session_charge',
  'fa100000-0000-4000-8000-000000000001',
  '10000000-0000-0000-0000-000000000001'
);

CREATE TEMP TABLE student_absence_guard_result AS
SELECT public.log_student_absences_self(
  jsonb_build_array(jsonb_build_object(
    'student_id', '10000000-0000-0000-0000-000000000001',
    'original_sessions_students_id', 'fb100000-0000-4000-8000-000000000001',
    'action', 'reschedule',
    'target_session_id', 'fa100000-0000-4000-8000-000000000002'
  )),
  '10000000-0000-0000-0000-000000000001'
) AS result;

SELECT is(
  (SELECT result->>'success' FROM student_absence_guard_result),
  'false',
  'student RPC rejects an absence after the session has been invoiced'
);

SELECT is(
  (SELECT result->>'code' FROM student_absence_guard_result),
  'SESSION_ALREADY_INVOICED',
  'student RPC returns a stable invoiced-session error code'
);

SELECT is(
  (SELECT planned_absence FROM public.sessions_students
   WHERE id = 'fb100000-0000-4000-8000-000000000001'),
  false,
  'an invoiced session remains unchanged'
);

SELECT * FROM finish();
ROLLBACK;
