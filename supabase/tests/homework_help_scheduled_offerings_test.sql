BEGIN;

SELECT plan(15);

SELECT enum_has_labels(
  'public',
  'session_type',
  ARRAY[
    'CLASS', 'DRAFTING', 'EXAM_COURSE', 'SUBSIDY_INTERVIEW',
    'TRIAL_SESSION', 'STAFF_INTERVIEW', 'ADMIN_SHIFT', 'CHECK_IN',
    'ADMIN_MEETING', 'HOMEWORK_HELP'
  ],
  'Homework Help is a first-class Session type'
);

SELECT has_column('public', 'classes', 'session_type', 'Scheduled offerings store their type');
SELECT has_column('public', 'class_schedule_revisions', 'session_type', 'Schedule revisions store their type');

CREATE TEMP TABLE homework_help_proposal AS
SELECT jsonb_build_object(
  'class_id', 'fa720000-0000-4000-8000-000000000001',
  'session_type', 'HOMEWORK_HELP',
  'subject_id', NULL,
  'billing_type', NULL,
  'cohort_label', '',
  'status', 'ACTIVE',
  'schedule_type', 'RECURRING',
  'start_date', '2028-01-02',
  'end_date', '2028-01-16',
  'effective_from', '2028-01-02',
  'timezone', 'Australia/Adelaide',
  'frequency_weeks', 1,
  'anchor_date', '2028-01-02',
  'recurring_rows', jsonb_build_array(
    jsonb_build_object(
      'day_of_week', 0,
      'start_time', '10:00',
      'end_time', '12:00',
      'room', 'Drop-in room',
      'position', 0
    )
  )
) AS proposal;

SELECT lives_ok(
  $$
    SELECT public.apply_class_schedule(
      proposal,
      public.preview_class_schedule(proposal)->>'proposal_hash'
    )
    FROM homework_help_proposal
  $$,
  'Homework Help reuses the Scheduled offering recurrence engine'
);

SELECT is(
  (SELECT session_type::TEXT FROM public.classes WHERE id = 'fa720000-0000-4000-8000-000000000001'),
  'HOMEWORK_HELP',
  'the offering is explicitly Homework Help'
);

SELECT is(
  (SELECT subject_id IS NULL AND billing_type IS NULL FROM public.classes WHERE id = 'fa720000-0000-4000-8000-000000000001'),
  TRUE,
  'Homework Help has neither a Subject nor Student billing type'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.sessions WHERE class_id = 'fa720000-0000-4000-8000-000000000001'),
  3,
  'the weekly offering materializes dated Sessions'
);

SELECT is(
  (
    SELECT bool_and(type = 'HOMEWORK_HELP' AND subject_id IS NULL AND billing_type IS NULL)
    FROM public.sessions
    WHERE class_id = 'fa720000-0000-4000-8000-000000000001'
  ),
  TRUE,
  'generated Homework Help Sessions are typed and structurally non-billable'
);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.sessions_students student_session
    JOIN public.sessions session ON session.id = student_session.session_id
    WHERE session.class_id = 'fa720000-0000-4000-8000-000000000001'
  ),
  0,
  'drop-in attendance is not pre-created from enrolments'
);

INSERT INTO public.students (id, first_name, last_name, status)
VALUES ('fa720000-0000-4000-8000-000000000002', 'Drop-in', 'Student', 'ACTIVE');

INSERT INTO auth.users (
  instance_id, id, aud, email, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin, role
)
VALUES (
  (SELECT id FROM auth.instances LIMIT 1),
  'fa720000-0000-4000-8000-000000000005',
  'authenticated',
  'homework-help-visibility@student.test',
  NOW(),
  NOW(),
  '{"provider":"email","providers":["email"]}',
  '{}'::JSONB,
  FALSE,
  'authenticated'
);

UPDATE public.students
SET user_id = 'fa720000-0000-4000-8000-000000000005'
WHERE id = 'fa720000-0000-4000-8000-000000000002';

INSERT INTO public.sessions (id, type, class_id, start_at, end_at, status)
VALUES (
  'fa720000-0000-4000-8000-000000000006',
  'HOMEWORK_HELP',
  'fa720000-0000-4000-8000-000000000001',
  NOW() - INTERVAL '2 hours',
  NOW() - INTERVAL '1 hour',
  'ACTIVE'
);

SELECT lives_ok(
  $$
    INSERT INTO public.sessions_students (id, session_id, student_id)
    SELECT
      'fa720000-0000-4000-8000-000000000003',
      session.id,
      'fa720000-0000-4000-8000-000000000002'
    FROM public.sessions session
    WHERE session.class_id = 'fa720000-0000-4000-8000-000000000001'
      AND session.start_at >= NOW()
    ORDER BY session.start_at
    LIMIT 1
  $$,
  'a drop-in Student can be recorded directly on a Homework Help Session'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"fa720000-0000-4000-8000-000000000005","role":"authenticated"}',
  TRUE
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.vstudent_sessions WHERE session_type = 'HOMEWORK_HELP'),
  3,
  'an active Student can discover every upcoming Homework Help Session'
);

SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.vstudent_sessions WHERE session_id = 'fa720000-0000-4000-8000-000000000006'),
  0,
  'past Homework Help is hidden before the Student is recorded as a drop-in'
);

RESET ROLE;

INSERT INTO public.sessions_students (id, session_id, student_id)
VALUES (
  'fa720000-0000-4000-8000-000000000007',
  'fa720000-0000-4000-8000-000000000006',
  'fa720000-0000-4000-8000-000000000002'
);

SET LOCAL ROLE authenticated;
SELECT is(
  (SELECT COUNT(*)::INTEGER FROM public.vstudent_sessions WHERE session_id = 'fa720000-0000-4000-8000-000000000006'),
  1,
  'recorded drop-in attendance retains access to past Homework Help'
);

RESET ROLE;
UPDATE public.students SET status = 'DISCONTINUED'
WHERE id = 'fa720000-0000-4000-8000-000000000002';
SET LOCAL ROLE authenticated;

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM public.vstudent_sessions
    WHERE session_type = 'HOMEWORK_HELP'
      AND session_id <> 'fa720000-0000-4000-8000-000000000006'
      AND session_student_id IS NULL
  ),
  0,
  'inactive Students cannot discover unassigned upcoming Homework Help'
);

RESET ROLE;

SELECT throws_ok(
  $$
    INSERT INTO public.classes_students (id, class_id, student_id, enrolled_at)
    VALUES (
      'fa720000-0000-4000-8000-000000000004',
      'fa720000-0000-4000-8000-000000000001',
      'fa720000-0000-4000-8000-000000000002',
      NOW()
    )
  $$,
  'Homework Help uses drop-in Session attendance, not Class enrolment',
  'Homework Help rejects cohort enrolment'
);

SELECT * FROM finish();
ROLLBACK;
