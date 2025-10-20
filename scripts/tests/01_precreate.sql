-- Setup: clean prior test data and pre-create staff/students without user accounts
-- Emails and tokens used in tests
--   A) staff via invite_token: staff.invite@test.local, token aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa
--   B) student via email fallback: student.email@test.local
--   C) dual role candidate: dual@test.local, token bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb

-- Ensure required extensions for uuid
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Cleanup any auth users that might already exist for these emails
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_catalog.pg_namespace WHERE nspname = 'auth') THEN
    DELETE FROM auth.users WHERE email IN (
      'staff.invite@test.local',
      'student.email@test.local',
      'dual@test.local'
    );
  END IF;
EXCEPTION WHEN others THEN
  -- ignore if auth schema not available yet
  NULL;
END;$$;

-- Cleanup existing precreated rows
DELETE FROM public.staff WHERE email IN (
  'staff.invite@test.local',
  'dual@test.local'
);

DELETE FROM public.students WHERE student_email IN (
  'student.email@test.local',
  'dual@test.local'
);

-- A) Precreate staff using invite_token (ACTIVE)
INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  email,
  phone_number,
  role,
  status,
  notes,
  user_id,
  invite_token
) VALUES (
  uuid_generate_v4(),
  'Alice',
  'Invite',
  'staff.invite@test.local',
  NULL,
  'TUTOR',
  'ACTIVE',
  'Precreated staff awaiting signup',
  NULL,
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
);

-- B) Precreate student using email fallback (CURRENT)
INSERT INTO public.students (
  id,
  first_name,
  last_name,
  student_email,
  student_phone,
  status,
  notes,
  user_id,
  invite_token
) VALUES (
  uuid_generate_v4(),
  'Bob',
  'Student',
  'student.email@test.local',
  NULL,
  'ACTIVE',
  'Precreated student awaiting signup',
  NULL,
  NULL
);

-- C) Precreate both student and staff for same future user
--    Staff (ACTIVE) will link via invite_token; Student (CURRENT) should remain unlinked
INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  email,
  phone_number,
  role,
  status,
  notes,
  user_id,
  invite_token
) VALUES (
  uuid_generate_v4(),
  'Carol',
  'Dual',
  'dual@test.local',
  NULL,
  'TUTOR',
  'ACTIVE',
  'Dual-role test (staff)',
  NULL,
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
);

INSERT INTO public.students (
  id,
  first_name,
  last_name,
  student_email,
  student_phone,
  status,
  notes,
  user_id,
  invite_token
) VALUES (
  uuid_generate_v4(),
  'Carol',
  'Dual',
  'dual@test.local',
  NULL,
  'INACTIVE',
  'Dual-role test (student)',
  NULL,
  NULL
);


