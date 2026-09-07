BEGIN;

SELECT plan(15);

CREATE TEMP TABLE reschedule_matrix (
  scenario text PRIMARY KEY,
  student_id uuid NOT NULL,
  original_session_id uuid NOT NULL,
  target_session_id uuid NOT NULL,
  original_assignment_id uuid NOT NULL,
  original_invoice_id uuid NOT NULL,
  original_invoice_item_id uuid NOT NULL,
  credit_note_id uuid NOT NULL,
  replacement_assignment_id uuid
);

INSERT INTO reschedule_matrix (
  scenario,
  student_id,
  original_session_id,
  target_session_id,
  original_assignment_id,
  original_invoice_id,
  original_invoice_item_id,
  credit_note_id
)
VALUES
  (
    'original_only',
    '10000000-0000-0000-0000-000000000001',
    'fa000000-0000-4000-8000-000000000001',
    'fa000000-0000-4000-8000-000000000011',
    'fb000000-0000-4000-8000-000000000001',
    'fc000000-0000-4000-8000-000000000001',
    'fd000000-0000-4000-8000-000000000001',
    'fe000000-0000-4000-8000-000000000001'
  ),
  (
    'replacement_only',
    '10000000-0000-0000-0000-000000000002',
    'fa000000-0000-4000-8000-000000000002',
    'fa000000-0000-4000-8000-000000000012',
    'fb000000-0000-4000-8000-000000000002',
    'fc000000-0000-4000-8000-000000000002',
    'fd000000-0000-4000-8000-000000000002',
    'fe000000-0000-4000-8000-000000000002'
  ),
  (
    'both',
    '10000000-0000-0000-0000-000000000003',
    'fa000000-0000-4000-8000-000000000003',
    'fa000000-0000-4000-8000-000000000013',
    'fb000000-0000-4000-8000-000000000003',
    'fc000000-0000-4000-8000-000000000003',
    'fd000000-0000-4000-8000-000000000003',
    'fe000000-0000-4000-8000-000000000003'
  ),
  (
    'neither',
    '10000000-0000-0000-0000-000000000004',
    'fa000000-0000-4000-8000-000000000004',
    'fa000000-0000-4000-8000-000000000014',
    'fb000000-0000-4000-8000-000000000004',
    'fc000000-0000-4000-8000-000000000004',
    'fd000000-0000-4000-8000-000000000004',
    'fe000000-0000-4000-8000-000000000004'
  );

CREATE TEMP TABLE reschedule_session_template AS
SELECT type, subject_id, billing_type
FROM public.sessions
WHERE billing_type IS NOT NULL
  AND subject_id IS NOT NULL
  AND type <> 'TRIAL_SESSION'
LIMIT 1;

INSERT INTO public.sessions (
  id, type, class_id, subject_id, start_at, end_at, status, billing_type
)
SELECT
  fixture.original_session_id,
  template.type,
  '20000000-0000-0000-0000-000000000001',
  template.subject_id,
  now() + interval '2 days'
    + row_number() OVER (ORDER BY fixture.scenario) * interval '1 minute',
  now() + interval '2 days 90 minutes'
    + row_number() OVER (ORDER BY fixture.scenario) * interval '1 minute',
  'ACTIVE',
  template.billing_type
FROM reschedule_matrix fixture
CROSS JOIN reschedule_session_template template;

INSERT INTO public.sessions (
  id, type, class_id, subject_id, start_at, end_at, status, billing_type
)
SELECT
  fixture.target_session_id,
  template.type,
  '20000000-0000-0000-0000-000000000002',
  template.subject_id,
  now() + interval '10 days'
    + row_number() OVER (ORDER BY fixture.scenario) * interval '1 minute',
  now() + interval '10 days 90 minutes'
    + row_number() OVER (ORDER BY fixture.scenario) * interval '1 minute',
  'ACTIVE',
  template.billing_type
FROM reschedule_matrix fixture
CROSS JOIN reschedule_session_template template;

INSERT INTO public.sessions_students (
  id, session_id, student_id, planned_absence, is_credited, is_rescheduled, was_trial
)
SELECT
  original_assignment_id,
  original_session_id,
  student_id,
  false,
  false,
  false,
  false
FROM reschedule_matrix;

INSERT INTO public.invoices (
  id, student_id, stripe_invoice_id, invoice_date, amount_due_cents,
  amount_paid_cents, currency, status
)
SELECT
  original_invoice_id,
  student_id,
  'in_reschedule_matrix_' || scenario,
  current_date,
  9000,
  9000,
  'AUD',
  'paid'
FROM reschedule_matrix;

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_subsidy, is_fee, line_kind, session_id, student_id
)
SELECT
  original_invoice_item_id,
  original_invoice_id,
  original_assignment_id,
  'ii_reschedule_matrix_' || scenario,
  9000,
  'Reschedule attendance matrix',
  false,
  false,
  'session_charge',
  original_session_id,
  student_id
FROM reschedule_matrix;

CREATE TEMP TABLE logged_reschedule_matrix AS
SELECT public.log_student_absences_with_billing(
  (
    SELECT jsonb_agg(jsonb_build_object(
      'student_id', student_id,
      'original_sessions_students_id', original_assignment_id,
      'action', 'reschedule',
      'target_session_id', target_session_id
    ) ORDER BY scenario)
    FROM reschedule_matrix
  ),
  '00000000-0000-0000-0000-000000000001',
  'approved_absence',
  'reschedule attendance matrix'
) AS result;

SELECT is(
  (SELECT result->>'success' FROM logged_reschedule_matrix),
  'true',
  'the AdminStaff reschedule command accepts the complete attendance matrix'
);

UPDATE reschedule_matrix fixture
SET replacement_assignment_id = original.rescheduled_sessions_students_id
FROM public.sessions_students original
WHERE original.id = fixture.original_assignment_id;

UPDATE public.session_billing_adjustments adjustment
SET status = 'succeeded', completed_at = now()
FROM reschedule_matrix fixture
WHERE adjustment.sessions_students_id = fixture.original_assignment_id
  AND adjustment.kind = 'credit_note';

INSERT INTO public.credit_notes (
  id, invoice_id, stripe_credit_note_id, amount_cents, currency, reason,
  status, source_invoice_item_id, billing_adjustment_id
)
SELECT
  fixture.credit_note_id,
  fixture.original_invoice_id,
  'cn_reschedule_matrix_' || fixture.scenario,
  9000,
  'AUD',
  'approved absence',
  'issued',
  fixture.original_invoice_item_id,
  adjustment.id
FROM reschedule_matrix fixture
JOIN public.session_billing_adjustments adjustment
  ON adjustment.sessions_students_id = fixture.original_assignment_id
 AND adjustment.kind = 'credit_note';

INSERT INTO public.tutor_logs (id, session_id, created_by, session_type)
SELECT
  ('ff000000-0000-4000-8000-' || lpad(row_number() OVER (ORDER BY session.id)::text, 12, '0'))::uuid,
  session.id,
  '00000000-0000-0000-0000-000000000001',
  session.type
FROM public.sessions session
WHERE session.id IN (
  SELECT original_session_id FROM reschedule_matrix
  UNION ALL
  SELECT target_session_id FROM reschedule_matrix
);

INSERT INTO public.tutor_logs_student_attendance (
  tutor_log_id, student_id, attended, was_trial, created_by
)
SELECT
  log.id,
  fixture.student_id,
  true,
  false,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM reschedule_matrix fixture
JOIN public.tutor_logs log ON log.session_id = fixture.original_session_id
WHERE fixture.scenario IN ('original_only', 'both')
UNION ALL
SELECT
  log.id,
  fixture.student_id,
  true,
  false,
  '00000000-0000-0000-0000-000000000001'::uuid
FROM reschedule_matrix fixture
JOIN public.tutor_logs log ON log.session_id = fixture.target_session_id
WHERE fixture.scenario IN ('replacement_only', 'both');

SELECT is(
  (
    SELECT concat(
      public.session_student_is_chargeable(original_assignment_id),
      '/',
      public.session_student_is_chargeable(replacement_assignment_id)
    )
    FROM reschedule_matrix
    WHERE scenario = 'original_only'
  ),
  't/t',
  'attending only the original leaves both the attended original and missed replacement payable'
);

SELECT is(
  (
    SELECT concat(
      public.session_student_is_chargeable(original_assignment_id),
      '/',
      public.session_student_is_chargeable(replacement_assignment_id)
    )
    FROM reschedule_matrix
    WHERE scenario = 'replacement_only'
  ),
  'f/t',
  'attending only the replacement credits the original and charges the replacement'
);

SELECT is(
  (
    SELECT concat(
      public.session_student_is_chargeable(original_assignment_id),
      '/',
      public.session_student_is_chargeable(replacement_assignment_id)
    )
    FROM reschedule_matrix
    WHERE scenario = 'both'
  ),
  't/t',
  'attending both the original and replacement makes both payable'
);

SELECT is(
  (
    SELECT concat(
      public.session_student_is_chargeable(original_assignment_id),
      '/',
      public.session_student_is_chargeable(replacement_assignment_id)
    )
    FROM reschedule_matrix
    WHERE scenario = 'neither'
  ),
  'f/t',
  'attending neither still leaves the assigned replacement payable'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.session_billing_adjustments adjustment
    JOIN reschedule_matrix fixture
      ON fixture.original_assignment_id = adjustment.sessions_students_id
    WHERE adjustment.kind = 'restoration_charge'
      AND adjustment.status = 'pending'
  ),
  2,
  'only originals that were actually attended receive restoration charges'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.session_billing_adjustments adjustment
    JOIN reschedule_matrix fixture
      ON fixture.replacement_assignment_id = adjustment.sessions_students_id
    WHERE adjustment.kind = 'session_charge'
      AND adjustment.status = 'pending'
  ),
  4,
  'each replacement retains exactly one normal session charge'
);

CREATE TEMP TABLE unbilled_replacement_undo AS
SELECT public.undo_student_absences_with_billing(
  jsonb_build_array(jsonb_build_object(
    'student_id', fixture.student_id,
    'original_sessions_students_id', fixture.original_assignment_id,
    'action', 'reschedule'
  )),
  '00000000-0000-0000-0000-000000000001',
  'student refused the offered replacement'
) AS result
FROM reschedule_matrix fixture
WHERE fixture.scenario = 'neither';

SELECT is(
  (SELECT result->>'success' FROM unbilled_replacement_undo),
  'true',
  'AdminStaff can undo a refused replacement before it is billed or attended'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.sessions_students assignment
    JOIN reschedule_matrix fixture
      ON fixture.replacement_assignment_id = assignment.id
    WHERE fixture.scenario = 'neither'
  ),
  0,
  'undo removes the unused replacement assignment'
);

SELECT is(
  (
    SELECT public.session_student_is_chargeable(original_assignment_id)
    FROM reschedule_matrix
    WHERE scenario = 'neither'
  ),
  true,
  'undo leaves the late-notice original payable'
);

SELECT is(
  (
    SELECT count(*)::integer
    FROM public.session_billing_adjustments adjustment
    JOIN reschedule_matrix fixture
      ON fixture.original_assignment_id = adjustment.sessions_students_id
    WHERE fixture.scenario = 'neither'
      AND adjustment.kind = 'restoration_charge'
      AND adjustment.status = 'pending'
  ),
  1,
  'undo queues restoration when the original credit note already exists'
);

INSERT INTO public.invoices (
  id, student_id, stripe_invoice_id, invoice_date, amount_due_cents,
  amount_paid_cents, currency, status
)
SELECT
  'fc000000-0000-4000-8000-000000000011',
  student_id,
  'in_billed_replacement_undo_guard',
  current_date,
  9000,
  9000,
  'AUD',
  'paid'
FROM reschedule_matrix
WHERE scenario = 'original_only';

INSERT INTO public.invoice_items (
  id, invoice_id, sessions_students_id, stripe_invoice_item_id, amount_cents,
  description, is_subsidy, is_fee, line_kind, session_id, student_id
)
SELECT
  'fd000000-0000-4000-8000-000000000011',
  'fc000000-0000-4000-8000-000000000011',
  replacement_assignment_id,
  'ii_billed_replacement_undo_guard',
  9000,
  'Billed replacement undo guard',
  false,
  false,
  'session_charge',
  target_session_id,
  student_id
FROM reschedule_matrix
WHERE scenario = 'original_only';

CREATE TEMP TABLE billed_replacement_undo AS
SELECT public.undo_student_absences_with_billing(
  jsonb_build_array(jsonb_build_object(
    'student_id', fixture.student_id,
    'original_sessions_students_id', fixture.original_assignment_id,
    'action', 'reschedule'
  )),
  '00000000-0000-0000-0000-000000000001',
  'attempted undo after billing'
) AS result
FROM reschedule_matrix fixture
WHERE fixture.scenario = 'original_only';

SELECT matches(
  (SELECT result->>'error' FROM billed_replacement_undo),
  '^Cannot undo reschedule: linked session already has invoice items$',
  'undo refuses to delete a replacement with financial history'
);

SELECT ok(
  (
    SELECT rescheduled_sessions_students_id IS NOT NULL
    FROM public.sessions_students original
    JOIN reschedule_matrix fixture ON fixture.original_assignment_id = original.id
    WHERE fixture.scenario = 'original_only'
  ),
  'a blocked billed-replacement undo leaves the reschedule intact'
);

CREATE TEMP TABLE attended_replacement_undo AS
SELECT public.undo_student_absences_with_billing(
  jsonb_build_array(jsonb_build_object(
    'student_id', fixture.student_id,
    'original_sessions_students_id', fixture.original_assignment_id,
    'action', 'reschedule'
  )),
  '00000000-0000-0000-0000-000000000001',
  'attempted undo after attendance'
) AS result
FROM reschedule_matrix fixture
WHERE fixture.scenario = 'replacement_only';

SELECT matches(
  (SELECT result->>'error' FROM attended_replacement_undo),
  '^Cannot undo reschedule: linked session already has attendance logged$',
  'undo refuses to delete a replacement with attendance history'
);

SELECT ok(
  (
    SELECT rescheduled_sessions_students_id IS NOT NULL
    FROM public.sessions_students original
    JOIN reschedule_matrix fixture ON fixture.original_assignment_id = original.id
    WHERE fixture.scenario = 'replacement_only'
  ),
  'a blocked attended-replacement undo leaves the reschedule intact'
);

SELECT * FROM finish();

ROLLBACK;
