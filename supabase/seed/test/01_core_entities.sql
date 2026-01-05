-- Seed data for core entities: staff, students, subjects
-- This file seeds the foundational tables that other tables depend on

-- ========================
-- STAFF
-- ========================
-- Note: user_id is set to NULL for local testing. In production, these would link to auth.users
INSERT INTO public.staff (id, first_name, last_name, email, phone_number, role, status, notes, user_id)
VALUES
  -- Admin staff
  ('00000000-0000-0000-0000-000000000001', 'Admin', 'User', 'admin@altitutor.test', '+61400000001', 'ADMINSTAFF', 'ACTIVE', 'Test admin user', NULL),
  ('00000000-0000-0000-0000-000000000002', 'Jane', 'Smith', 'jane.smith@altitutor.test', '+61400000002', 'ADMINSTAFF', 'ACTIVE', 'Office manager', NULL),
  
  -- Tutors
  ('00000000-0000-0000-0000-000000000010', 'John', 'Doe', 'john.doe@altitutor.test', '+61400000010', 'TUTOR', 'ACTIVE', 'Mathematics tutor', NULL),
  ('00000000-0000-0000-0000-000000000011', 'Sarah', 'Johnson', 'sarah.johnson@altitutor.test', '+61400000011', 'TUTOR', 'ACTIVE', 'Science tutor', NULL),
  ('00000000-0000-0000-0000-000000000012', 'Michael', 'Brown', 'michael.brown@altitutor.test', '+61400000012', 'TUTOR', 'ACTIVE', 'English tutor', NULL),
  ('00000000-0000-0000-0000-000000000013', 'Emily', 'Davis', 'emily.davis@altitutor.test', '+61400000013', 'TUTOR', 'ACTIVE', 'Mathematics and Physics tutor', NULL),
  ('00000000-0000-0000-0000-000000000014', 'David', 'Wilson', 'david.wilson@altitutor.test', '+61400000014', 'TUTOR', 'ACTIVE', 'Chemistry tutor', NULL),
  ('00000000-0000-0000-0000-000000000015', 'Lisa', 'Anderson', 'lisa.anderson@altitutor.test', '+61400000015', 'TUTOR', 'INACTIVE', 'Former tutor', NULL)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- STUDENTS
-- ========================
-- Note: notes column was removed from students table in migration 20251021000010_communications_schema.sql
-- Status values: 'ACTIVE', 'INACTIVE', 'TRIAL', 'DISCONTINUED' (changed from 'CURRENT' to 'ACTIVE')
INSERT INTO public.students (id, first_name, last_name, email, phone, status, user_id)
VALUES
  ('10000000-0000-0000-0000-000000000001', 'Alice', 'Williams', 'alice.williams@student.test', '+61410000001', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000002', 'Bob', 'Taylor', 'bob.taylor@student.test', '+61410000002', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000003', 'Charlie', 'Martinez', 'charlie.martinez@student.test', '+61410000003', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000004', 'Diana', 'Garcia', 'diana.garcia@student.test', '+61410000004', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000005', 'Edward', 'Lee', 'edward.lee@student.test', '+61410000005', 'TRIAL', NULL),
  ('10000000-0000-0000-0000-000000000006', 'Fiona', 'Harris', 'fiona.harris@student.test', '+61410000006', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000007', 'George', 'Clark', 'george.clark@student.test', '+61410000007', 'INACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000008', 'Hannah', 'Lewis', 'hannah.lewis@student.test', '+61410000008', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000009', 'Isaac', 'Walker', 'isaac.walker@student.test', '+61410000009', 'ACTIVE', NULL),
  ('10000000-0000-0000-0000-000000000010', 'Julia', 'Hall', 'julia.hall@student.test', '+61410000010', 'ACTIVE', NULL)
ON CONFLICT (id) DO NOTHING;

-- ========================
-- SUBJECTS
-- ========================
-- Note: Subjects are already seeded in migration 20250429000001_seed_subjects.sql
-- We'll add a few additional test subjects if needed, but most subjects are already there
-- This ensures we have some subjects to work with even if migrations haven't run

-- Get a few subject IDs for reference (these should exist from migrations)
-- We'll use these in later seed files
-- Mathematical Methods Year 12 SACE
-- Biology Year 12 SACE
-- Chemistry Year 12 SACE
-- Physics Year 12 SACE
-- English General Year 12 SACE

