BEGIN;
SELECT plan(5);

INSERT INTO public.staff (
  id,
  first_name,
  last_name,
  email,
  role,
  status
)
VALUES (
  'fc200000-0000-4000-8000-000000000001',
  'Cascade',
  'Fixture',
  'cascade.fixture@invalid.test',
  'TUTOR',
  'ACTIVE'
);

INSERT INTO public.classes_staff (
  id,
  staff_id,
  class_id,
  assigned_at,
  created_by,
  assigned_by
)
SELECT
  'fc200000-0000-4000-8000-000000000002',
  'fc200000-0000-4000-8000-000000000001',
  class_row.id,
  now(),
  admin_staff.id,
  admin_staff.id
FROM (
  SELECT id
  FROM public.classes
  ORDER BY id
  LIMIT 1
) AS class_row
CROSS JOIN (
  SELECT id
  FROM public.staff
  WHERE role = 'ADMINSTAFF'
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
) AS admin_staff;

SELECT is(
  (
    SELECT count(*)
    FROM public.classes_staff
    WHERE id = 'fc200000-0000-4000-8000-000000000002'
  ),
  1::bigint,
  'the staff deletion fixture includes a cascading class assignment'
);

INSERT INTO public.tutor_logs_staff_attendance (
  id,
  tutor_log_id,
  staff_id,
  attended,
  type
)
SELECT
  'fc200000-0000-4000-8000-000000000003',
  tutor_log.id,
  'fc200000-0000-4000-8000-000000000001',
  true,
  'SECONDARY_TUTOR'
FROM (
  SELECT id
  FROM public.tutor_logs
  ORDER BY id
  LIMIT 1
) AS tutor_log;

SELECT is(
  (
    SELECT count(*)
    FROM public.tutor_logs_staff_attendance
    WHERE id = 'fc200000-0000-4000-8000-000000000003'
  ),
  1::bigint,
  'the staff deletion fixture includes cascading tutor-log attendance'
);

INSERT INTO public.admin_shifts (
  id,
  day_of_week,
  start_time,
  end_time,
  status,
  created_by
)
SELECT
  'fc200000-0000-4000-8000-000000000004',
  0,
  '09:00',
  '10:00',
  'INACTIVE',
  admin_staff.id
FROM (
  SELECT id
  FROM public.staff
  WHERE role = 'ADMINSTAFF'
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
) AS admin_staff;

INSERT INTO public.admin_shifts_staff (
  id,
  admin_shift_id,
  staff_id,
  created_by
)
SELECT
  'fc200000-0000-4000-8000-000000000005',
  'fc200000-0000-4000-8000-000000000004',
  'fc200000-0000-4000-8000-000000000001',
  admin_staff.id
FROM (
  SELECT id
  FROM public.staff
  WHERE role = 'ADMINSTAFF'
    AND status = 'ACTIVE'
  ORDER BY id
  LIMIT 1
) AS admin_staff;

SELECT is(
  (
    SELECT count(*)
    FROM public.admin_shifts_staff
    WHERE id = 'fc200000-0000-4000-8000-000000000005'
  ),
  1::bigint,
  'the staff deletion fixture includes a cascading admin-shift assignment'
);

SELECT lives_ok(
  $$DELETE FROM public.staff
    WHERE id = 'fc200000-0000-4000-8000-000000000001'$$,
  'deleting assigned staff succeeds when activity events preserve deletion snapshots'
);

SELECT is(
  (
    SELECT count(*)
    FROM public.activity_events
    WHERE entity_type = 'classes_staff'
      AND entity_id = 'fc200000-0000-4000-8000-000000000002'
      AND event_type = 'DELETED'
      AND staff_id IS NULL
      AND metadata ->> 'deleted_staff_id' = 'fc200000-0000-4000-8000-000000000001'
  ),
  1::bigint,
  'the cascading assignment deletion is retained as a snapshot without a stale staff foreign key'
);

SELECT * FROM finish();
ROLLBACK;
