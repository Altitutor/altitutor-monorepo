BEGIN;
SELECT plan(4);

INSERT INTO public.staff_subjects (staff_id, subject_id)
SELECT '00000000-0000-0000-0000-000000000010', subject.id
FROM public.subjects subject
WHERE subject.name = 'Chemistry'
  AND subject.year_level = 11
  AND subject.curriculum = 'SACE'
LIMIT 1
ON CONFLICT DO NOTHING;

ALTER TABLE public.classes_staff DISABLE TRIGGER trigger_sync_staff_on_assignment;

INSERT INTO public.classes_staff (
  id,
  staff_id,
  class_id,
  assigned_at,
  assigned_by,
  unassigned_at,
  unassigned_by
)
VALUES (
  'fc230000-0000-4000-8000-000000000001',
  '00000000-0000-0000-0000-000000000010',
  '20000000-0000-0000-0000-000000000002',
  now() - interval '1 month',
  '00000000-0000-0000-0000-000000000001',
  now() - interval '1 day',
  '00000000-0000-0000-0000-000000000001'
);

ALTER TABLE public.classes_staff ENABLE TRIGGER trigger_sync_staff_on_assignment;

SET LOCAL ROLE authenticated;
SELECT set_config(
  'request.jwt.claims',
  '{"sub":"00000000-0000-0000-0000-000000000010","role":"authenticated"}',
  true
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.vtutor_subjects
    WHERE name = 'Mathematical Methods'
      AND year_level = 12
      AND curriculum = 'SACE'
  ),
  'a current class assignment grants the class subject'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM public.vtutor_subjects
    WHERE name = 'Chemistry'
      AND year_level = 11
      AND curriculum = 'SACE'
  ),
  'a staff_subjects row grants the subject without a class assignment'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.vtutor_subjects
    WHERE name = 'Biology'
      AND year_level = 12
      AND curriculum = 'SACE'
  ),
  'an unassigned class assignment does not grant the subject'
);

SELECT ok(
  NOT EXISTS (
    SELECT 1
    FROM public.vtutor_subjects
    WHERE name = 'Physics'
      AND year_level = 12
      AND curriculum = 'SACE'
  ),
  'a subject with neither grant is hidden'
);

SELECT * FROM finish();
ROLLBACK;
