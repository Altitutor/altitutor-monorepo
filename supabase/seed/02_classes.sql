-- Seed data for classes, class enrollments, and class staff assignments
-- Depends on: staff, students, subjects

-- ========================
-- CLASSES
-- ========================
-- Use fixed UUIDs for classes so we can reference them in enrollments and assignments
-- Get subject IDs dynamically from the subjects table
DO $$
DECLARE
  math_subject_id UUID;
  bio_subject_id UUID;
  chem_subject_id UUID;
  eng_subject_id UUID;
  physics_subject_id UUID;
  math_class_id UUID := '20000000-0000-0000-0000-000000000001';
  bio_class_id UUID := '20000000-0000-0000-0000-000000000002';
  chem_class_id UUID := '20000000-0000-0000-0000-000000000003';
  eng_class_id UUID := '20000000-0000-0000-0000-000000000004';
  physics_class_id UUID := '20000000-0000-0000-0000-000000000005';
BEGIN
  -- Get subject IDs
  SELECT id INTO math_subject_id FROM public.subjects WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO bio_subject_id FROM public.subjects WHERE name = 'Biology' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO chem_subject_id FROM public.subjects WHERE name = 'Chemistry' AND year_level = 11 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO eng_subject_id FROM public.subjects WHERE name = 'English General' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO physics_subject_id FROM public.subjects WHERE name = 'Physics' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;

  -- Insert classes
  INSERT INTO public.classes (id, subject_id, day_of_week, start_time, end_time, max_capacity, status, notes, level)
  VALUES
    (math_class_id, math_subject_id, 1, '16:00', '17:30', 8, 'ACTIVE', 'Year 12 Mathematical Methods class', NULL),
    (bio_class_id, bio_subject_id, 2, '17:00', '18:30', 10, 'ACTIVE', 'Year 12 Biology class', NULL),
    (chem_class_id, chem_subject_id, 3, '16:30', '18:00', 6, 'ACTIVE', 'Year 11 Chemistry class', NULL),
    (eng_class_id, eng_subject_id, 4, '17:30', '19:00', 8, 'ACTIVE', 'Year 12 English General class', NULL),
    (physics_class_id, physics_subject_id, 5, '16:00', '17:30', 8, 'INACTIVE', 'Inactive class for testing', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- CLASS ENROLLMENTS
  -- ========================
  INSERT INTO public.class_enrollments (id, student_id, class_id, start_date, end_date, status)
  VALUES
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', math_class_id, '2024-01-15', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', math_class_id, '2024-01-15', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', math_class_id, '2024-02-01', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', bio_class_id, '2024-01-15', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', bio_class_id, '2024-03-01', NULL, 'TRIAL'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000006', chem_class_id, '2024-01-15', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000008', eng_class_id, '2024-01-15', NULL, 'ACTIVE'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', eng_class_id, '2024-01-15', NULL, 'ACTIVE') -- Alice in multiple classes
  ON CONFLICT DO NOTHING;

  -- ========================
  -- CLASS STAFF ASSIGNMENTS (classes_staff)
  -- ========================
  INSERT INTO public.classes_staff (id, staff_id, class_id, assigned_at, assigned_by)
  VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', math_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000013', math_class_id, NOW() - INTERVAL '1 month', '00000000-0000-0000-0000-000000000001'), -- Secondary tutor
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000011', bio_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000014', chem_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000012', eng_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;
END $$;


