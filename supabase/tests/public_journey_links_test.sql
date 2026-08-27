BEGIN;
SELECT plan(18);

INSERT INTO public.students (
  id, first_name, last_name, email, status, invite_token
) VALUES (
  'fd000000-0000-4000-8000-000000000001',
  'Durable',
  'Registration',
  'durable-registration@student.test',
  'TRIAL',
  'fd000000-0000-4000-8000-000000000010'
);

INSERT INTO public.sessions (
  id, type, start_at, end_at, status
) VALUES (
  'fd000000-0000-4000-8000-000000000002',
  'TRIAL_SESSION',
  NOW() + INTERVAL '7 days',
  NOW() + INTERVAL '7 days 45 minutes',
  'ACTIVE'
);

INSERT INTO public.students (
  id, first_name, last_name, email, status
) VALUES (
  'fd000000-0000-4000-8000-000000000003',
  'Unavailable',
  'Registration',
  'unavailable-registration@student.test',
  'TRIAL'
);

SET LOCAL ROLE service_role;

CREATE TEMP TABLE issued_registration AS
SELECT public.issue_student_registration_public_token(
  'fd000000-0000-4000-8000-000000000001'
) AS token;

SELECT matches(
  (SELECT token FROM issued_registration),
  '^[A-Za-z0-9_-]{22}$',
  'registration links use a 22-character URL-safe public token'
);

SELECT is(
  public.issue_student_registration_public_token(
    'fd000000-0000-4000-8000-000000000001'
  ),
  (SELECT token FROM issued_registration),
  'issuing a registration link repeatedly returns the stable token'
);

SELECT is(
  (
    SELECT registration_public_token
    FROM public.students
    WHERE id = 'fd000000-0000-4000-8000-000000000001'
  ),
  (SELECT token FROM issued_registration),
  'the Student owns the issued registration public token'
);

SELECT is(
  (
    SELECT invite_token
    FROM public.students
    WHERE id = 'fd000000-0000-4000-8000-000000000001'
  ),
  'fd000000-0000-4000-8000-000000000010'::uuid,
  'issuing a registration link does not rotate the account invite token'
);

UPDATE public.students
SET
  invite_token = 'fd000000-0000-4000-8000-000000000011',
  legacy_registration_token = 'fd000000-0000-4000-8000-000000000012'
WHERE id = 'fd000000-0000-4000-8000-000000000001';

SELECT is(
  (
    SELECT registration_public_token
    FROM public.students
    WHERE id = 'fd000000-0000-4000-8000-000000000001'
  ),
  (SELECT token FROM issued_registration),
  'replacing the account invite does not invalidate the registration link'
);

SELECT is(
  (
    public.complete_student_registration_public(
      p_token => (SELECT token FROM issued_registration),
      p_student_first_name => 'Durable',
      p_student_last_name => 'Registration',
      p_student_email => 'durable-registration@student.test',
      p_student_phone => '0499999986',
      p_availability_monday => TRUE,
      p_parents => '[{"first_name":"Test","last_name":"Parent","email":"durable-parent@test.invalid","phone":"0499999987"}]'::JSONB
    )->>'success'
  )::BOOLEAN,
  TRUE,
  'the durable public token completes registration'
);

SELECT is(
  (
    SELECT invite_token
    FROM public.students
    WHERE id = 'fd000000-0000-4000-8000-000000000001'
  ),
  'fd000000-0000-4000-8000-000000000011'::UUID,
  'registration completion does not consume the independent account invite'
);

CREATE TEMP TABLE issued_booking AS
SELECT public.issue_session_booking_public_token(
  'fd000000-0000-4000-8000-000000000002'
) AS token;

SELECT matches(
  (SELECT token FROM issued_booking),
  '^[A-Za-z0-9_-]{22}$',
  'booking links use a 22-character URL-safe public token'
);

SELECT is(
  public.issue_session_booking_public_token(
    'fd000000-0000-4000-8000-000000000002'
  ),
  (SELECT token FROM issued_booking),
  'issuing a booking link repeatedly returns the stable token'
);

CREATE TEMP TABLE unavailable_registration AS
SELECT public.issue_student_registration_public_token(
  'fd000000-0000-4000-8000-000000000003'
) AS token;

UPDATE public.students
SET status = 'DISCONTINUED'
WHERE id = 'fd000000-0000-4000-8000-000000000003';

SELECT is(
  (
    public.complete_student_registration_public(
      p_token => (SELECT token FROM unavailable_registration),
      p_student_first_name => 'Unavailable',
      p_student_last_name => 'Registration',
      p_student_email => 'unavailable-registration@student.test',
      p_student_phone => '0499999988'
    )->>'success'
  )::BOOLEAN,
  FALSE,
  'a discontinued Student cannot be reactivated through an old registration link'
);

UPDATE public.students
SET status = NULL
WHERE id = 'fd000000-0000-4000-8000-000000000003';

SELECT is(
  (
    public.complete_student_registration_public(
      p_token => (SELECT token FROM unavailable_registration),
      p_student_first_name => 'Unavailable',
      p_student_last_name => 'Registration',
      p_student_email => 'unavailable-registration@student.test',
      p_student_phone => '0499999988'
    )->>'success'
  )::BOOLEAN,
  FALSE,
  'a Student with no lifecycle status cannot complete registration'
);

CREATE TEMP TABLE rotated_registration AS
SELECT public.rotate_student_registration_public_token(
  'fd000000-0000-4000-8000-000000000001'
) AS token;

SELECT isnt(
  (SELECT token FROM rotated_registration),
  (SELECT token FROM issued_registration),
  'explicit registration-link revocation returns a replacement token'
);

-- Tombstones are intentionally unreadable by API roles. Inspect persistence as
-- the database owner, then return to the production service-role boundary.
RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.public_link_revocations
    WHERE token = (SELECT token FROM issued_registration)
      AND purpose = 'REGISTRATION'
  ),
  'the revoked registration token is retained as a tombstone'
);

SET LOCAL ROLE service_role;

SELECT is(
  (
    public.complete_student_registration_public(
      p_token => (SELECT token FROM issued_registration),
      p_student_first_name => 'Durable',
      p_student_last_name => 'Registration',
      p_student_email => 'durable-registration@student.test',
      p_student_phone => '0499999986'
    )->>'success'
  )::BOOLEAN,
  FALSE,
  'an explicitly revoked registration token is no longer actionable'
);

SELECT is(
  (
    SELECT legacy_registration_token
    FROM public.students
    WHERE id = 'fd000000-0000-4000-8000-000000000001'
  ),
  NULL::uuid,
  'rotating a registration link disables its legacy registration alias'
);

CREATE TEMP TABLE rotated_booking AS
SELECT public.rotate_session_booking_public_token(
  'fd000000-0000-4000-8000-000000000002'
) AS token;

SELECT isnt(
  (SELECT token FROM rotated_booking),
  (SELECT token FROM issued_booking),
  'explicit booking-link revocation returns a replacement token'
);

RESET ROLE;

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.public_link_revocations
    WHERE token = 'fd000000-0000-4000-8000-000000000002'
      AND purpose = 'BOOKING'
  ),
  'rotating a booking link disables the legacy Session-ID URL'
);

SET LOCAL ROLE service_role;

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.activity_events
    WHERE changed_fields::text LIKE '%fd000000-0000-4000-8000-000000000010%'
       OR changed_fields::text LIKE '%fd000000-0000-4000-8000-000000000011%'
       OR changed_fields::text LIKE '%fd000000-0000-4000-8000-000000000012%'
       OR changed_fields::text LIKE '%' || (SELECT token FROM issued_registration) || '%'
       OR changed_fields::text LIKE '%' || (SELECT token FROM issued_booking) || '%'
  ),
  'activity events never expose public or account tokens'
);

SELECT * FROM finish();
ROLLBACK;
