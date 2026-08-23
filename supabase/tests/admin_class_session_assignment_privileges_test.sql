BEGIN;

SELECT plan(9);

SELECT is(
  (
    SELECT COUNT(*)::INTEGER
    FROM pg_proc procedure
    JOIN pg_namespace namespace ON namespace.oid = procedure.pronamespace
    WHERE namespace.nspname = 'public'
      AND procedure.proname IN (
        'extract_activity_fks_classes_staff',
        'extract_activity_fks_sessions_staff',
        'extract_activity_fks_tutor_logs_staff_attendance',
        'extract_activity_fks_admin_shifts_staff'
      )
      AND procedure.prosecdef
      AND procedure.proconfig @> ARRAY['search_path=public']::TEXT[]
      AND NOT has_function_privilege('authenticated', procedure.oid, 'EXECUTE')
  ),
  4,
  'staff activity triggers use private fixed-path security-definer boundaries'
);

-- Seed rows used by the removal checks while still running as the database owner.
INSERT INTO public.sessions_staff (id, session_id, staff_id, type)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffff01',
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000002',
  'MAIN_TUTOR'
);

INSERT INTO public.sessions_students (id, session_id, student_id)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffff02',
  '50000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000005'
);

INSERT INTO public.classes_staff (
  id,
  class_id,
  staff_id,
  assigned_at,
  assigned_by
)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffff03',
  '20000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  NOW() - INTERVAL '1 second',
  '00000000-0000-0000-0000-000000000001'
);

INSERT INTO public.classes_students (
  id,
  class_id,
  student_id,
  enrolled_at,
  enrolled_by
)
VALUES (
  'ffffffff-ffff-ffff-ffff-ffffffffff04',
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000007',
  NOW() - INTERVAL '1 second',
  '00000000-0000-0000-0000-000000000001'
);

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

SELECT lives_ok(
  $$
    INSERT INTO public.sessions_staff (id, session_id, staff_id, type)
    VALUES (
      'ffffffff-ffff-ffff-ffff-ffffffffff11',
      '50000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000001',
      'MAIN_TUTOR'
    )
  $$,
  'ADMINSTAFF can assign staff to a Session'
);

SELECT lives_ok(
  $$
    DELETE FROM public.sessions_staff
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffff01'
  $$,
  'ADMINSTAFF can remove staff from a Session'
);

SELECT lives_ok(
  $$
    INSERT INTO public.sessions_students (id, session_id, student_id)
    VALUES (
      'ffffffff-ffff-ffff-ffff-ffffffffff12',
      '50000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000004'
    )
  $$,
  'ADMINSTAFF can add a student to a Session'
);

SELECT lives_ok(
  $$
    DELETE FROM public.sessions_students
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffff02'
  $$,
  'ADMINSTAFF can remove a student from a Session'
);

SELECT lives_ok(
  $$
    INSERT INTO public.classes_staff (
      id,
      class_id,
      staff_id,
      assigned_at,
      assigned_by
    )
    VALUES (
      'ffffffff-ffff-ffff-ffff-ffffffffff13',
      '20000000-0000-0000-0000-000000000001',
      '00000000-0000-0000-0000-000000000012',
      NOW(),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'ADMINSTAFF can assign staff to a Class'
);

SELECT lives_ok(
  $$
    UPDATE public.classes_staff
    SET
      unassigned_at = NOW(),
      unassigned_by = '00000000-0000-0000-0000-000000000001'
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffff03'
  $$,
  'ADMINSTAFF can remove staff from a Class'
);

SELECT lives_ok(
  $$
    SELECT public.enroll_student_in_class(
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000006',
      NOW(),
      '00000000-0000-0000-0000-000000000001'
    )
  $$,
  'ADMINSTAFF can add a student to a Class'
);

SELECT lives_ok(
  $$
    UPDATE public.classes_students
    SET
      unenrolled_at = NOW(),
      unenrolled_by = '00000000-0000-0000-0000-000000000001'
    WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffff04'
  $$,
  'ADMINSTAFF can remove a student from a Class'
);

RESET ROLE;

SELECT * FROM finish();
ROLLBACK;
