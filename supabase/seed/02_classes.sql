-- Seed data for classes, class enrollments, and class staff assignments
-- Depends on: staff, students, subjects

-- Ensure uuid-ossp extension is enabled (required by trigger functions)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

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
  -- Set search path to ensure extension functions are accessible
  SET LOCAL search_path = public, pg_catalog;
  
  -- Get subject IDs
  SELECT id INTO math_subject_id FROM public.subjects WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO bio_subject_id FROM public.subjects WHERE name = 'Biology' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO chem_subject_id FROM public.subjects WHERE name = 'Chemistry' AND year_level = 11 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO eng_subject_id FROM public.subjects WHERE name = 'English General' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO physics_subject_id FROM public.subjects WHERE name = 'Physics' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;

  -- Insert classes
  -- Note: max_capacity column was removed in migration 20250427000000_schema_updates.sql
  -- Note: notes column was removed in migration 20251021000013_remove_audit_tables_and_notes.sql
  INSERT INTO public.classes (id, subject_id, day_of_week, start_time, end_time, status, level)
  VALUES
    (math_class_id, math_subject_id, 1, '16:00', '17:30', 'ACTIVE', NULL),
    (bio_class_id, bio_subject_id, 2, '17:00', '18:30', 'ACTIVE', NULL),
    (chem_class_id, chem_subject_id, 3, '16:30', '18:00', 'ACTIVE', NULL),
    (eng_class_id, eng_subject_id, 4, '17:30', '19:00', 'ACTIVE', NULL),
    (physics_class_id, physics_subject_id, 5, '16:00', '17:30', 'INACTIVE', NULL)
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- CLASS ENROLLMENTS (classes_students)
  -- ========================
  -- Note: Schema changed in migration 20251107000000_auditable_class_enrollments.sql
  -- Old columns (start_date, end_date, status) replaced with (enrolled_at, enrolled_by, unenrolled_at, unenrolled_by)
  -- Temporarily disable trigger to avoid uuid_generate_v4() issue (sessions don't exist yet anyway)
  ALTER TABLE public.classes_students DISABLE TRIGGER trigger_sync_student_on_enrollment;
  
  INSERT INTO public.classes_students (id, student_id, class_id, enrolled_at, enrolled_by)
  VALUES
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', math_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000002', math_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000003', math_class_id, '2024-02-01'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000004', bio_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000005', bio_class_id, '2024-03-01'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000006', chem_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000008', eng_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '10000000-0000-0000-0000-000000000001', eng_class_id, '2024-01-15'::TIMESTAMPTZ, '00000000-0000-0000-0000-000000000001') -- Alice in multiple classes
  ON CONFLICT DO NOTHING;
  
  -- Re-enable trigger
  ALTER TABLE public.classes_students ENABLE TRIGGER trigger_sync_student_on_enrollment;

  -- ========================
  -- CLASS STAFF ASSIGNMENTS (classes_staff)
  -- ========================
  -- Note: Schema changed in migration 20251117000000_auditable_class_staff.sql
  -- Old columns (start_date, end_date, status) replaced with (assigned_at, assigned_by, unassigned_at, unassigned_by)
  -- Temporarily disable triggers to avoid uuid_generate_v4() issue
  ALTER TABLE public.classes_staff DISABLE TRIGGER trigger_sync_staff_on_assignment;
  
  INSERT INTO public.classes_staff (id, staff_id, class_id, assigned_at, assigned_by)
  VALUES
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000010', math_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000013', math_class_id, NOW() - INTERVAL '1 month', '00000000-0000-0000-0000-000000000001'), -- Secondary tutor
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000011', bio_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000014', chem_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), '00000000-0000-0000-0000-000000000012', eng_class_id, NOW() - INTERVAL '3 months', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;
  
  -- Re-enable trigger
  ALTER TABLE public.classes_staff ENABLE TRIGGER trigger_sync_staff_on_assignment;
END $$;


