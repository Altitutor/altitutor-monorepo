BEGIN;

SELECT plan(8);

INSERT INTO public.notifications (
  id,
  staff_id,
  student_id,
  notification_type,
  app_scope,
  title,
  body
)
VALUES
  (
    'fb000000-0000-4000-8000-000000000001',
    NULL,
    '10000000-0000-0000-0000-000000000001',
    'facade_test',
    'student_web',
    'Student notification',
    'Visible only in Student Web.'
  ),
  (
    'fb000000-0000-4000-8000-000000000002',
    NULL,
    '10000000-0000-0000-0000-000000000001',
    'facade_test',
    'ucat_web',
    'UCAT notification',
    'Visible only in Altitutor UCAT.'
  ),
  (
    'fb000000-0000-4000-8000-000000000003',
    '00000000-0000-0000-0000-000000000010',
    NULL,
    'facade_test',
    'staff_web',
    'Tutor notification',
    'Visible only to the tutor.'
  );

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  0::bigint,
  'students cannot read the notifications base table'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vstudent_notifications
    WHERE notification_type = 'facade_test'
  ),
  1::bigint,
  'the Student Web notification facade returns the current student notifications'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vucat_notifications
    WHERE notification_type = 'facade_test'
  ),
  1::bigint,
  'the UCAT notification facade returns the current student notifications'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vtutor_notifications
    WHERE notification_type = 'facade_test'
  ),
  0::bigint,
  'a student cannot read tutor notifications'
);

RESET ROLE;
SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT is(
  (SELECT count(*) FROM public.notifications),
  0::bigint,
  'tutors cannot read the notifications base table'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vstudent_notifications
    WHERE notification_type = 'facade_test'
  ),
  0::bigint,
  'a tutor cannot read Student Web notifications'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vucat_notifications
    WHERE notification_type = 'facade_test'
  ),
  0::bigint,
  'a tutor cannot read UCAT notifications'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.vtutor_notifications
    WHERE notification_type = 'facade_test'
  ),
  1::bigint,
  'the tutor notification facade returns the current tutor notifications'
);

SELECT * FROM finish();

ROLLBACK;
