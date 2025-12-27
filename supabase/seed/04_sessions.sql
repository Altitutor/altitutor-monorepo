-- Seed data for sessions, sessions_staff, and sessions_students
-- Depends on: classes, staff, students, subjects

DO $$
DECLARE
  math_class_id UUID := '20000000-0000-0000-0000-000000000001';
  bio_class_id UUID := '20000000-0000-0000-0000-000000000002';
  chem_class_id UUID := '20000000-0000-0000-0000-000000000003';
  eng_class_id UUID := '20000000-0000-0000-0000-000000000004';
  math_subject_id UUID;
  bio_subject_id UUID;
  chem_subject_id UUID;
  eng_subject_id UUID;
  session1_id UUID := '50000000-0000-0000-0000-000000000001';
  session2_id UUID := '50000000-0000-0000-0000-000000000002';
  session3_id UUID := '50000000-0000-0000-0000-000000000003';
  session4_id UUID := '50000000-0000-0000-0000-000000000004';
  session5_id UUID := '50000000-0000-0000-0000-000000000005';
BEGIN
  -- Get subject IDs
  SELECT id INTO math_subject_id FROM public.subjects WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO bio_subject_id FROM public.subjects WHERE name = 'Biology' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO chem_subject_id FROM public.subjects WHERE name = 'Chemistry' AND year_level = 11 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO eng_subject_id FROM public.subjects WHERE name = 'English General' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;

  -- ========================
  -- SESSIONS
  -- ========================
  -- Create sessions for the past few weeks and upcoming weeks
  -- Monday sessions (Math)
  INSERT INTO public.sessions (id, class_id, subject_id, type, start_at, end_at, status, notes)
  VALUES
    -- Past sessions
    (session1_id, math_class_id, math_subject_id, 'CLASS', 
     (CURRENT_DATE - INTERVAL '7 days' + TIME '16:00')::TIMESTAMPTZ,
     (CURRENT_DATE - INTERVAL '7 days' + TIME '17:30')::TIMESTAMPTZ,
     'ACTIVE', 'Functions and Graphs'),
    -- This week
    (session2_id, bio_class_id, bio_subject_id, 'CLASS',
     (CURRENT_DATE - INTERVAL '6 days' + TIME '17:00')::TIMESTAMPTZ,
     (CURRENT_DATE - INTERVAL '6 days' + TIME '18:30')::TIMESTAMPTZ,
     'ACTIVE', 'Cell Biology'),
    -- Next week
    (session3_id, chem_class_id, chem_subject_id, 'CLASS',
     (CURRENT_DATE - INTERVAL '5 days' + TIME '16:30')::TIMESTAMPTZ,
     (CURRENT_DATE - INTERVAL '5 days' + TIME '18:00')::TIMESTAMPTZ,
     'ACTIVE', 'Atomic Structure'),
    (session4_id, eng_class_id, eng_subject_id, 'CLASS',
     (CURRENT_DATE - INTERVAL '4 days' + TIME '17:30')::TIMESTAMPTZ,
     (CURRENT_DATE - INTERVAL '4 days' + TIME '19:00')::TIMESTAMPTZ,
     'ACTIVE', 'Essay Writing'),
    -- Upcoming session
    (session5_id, math_class_id, math_subject_id, 'CLASS',
     (CURRENT_DATE + INTERVAL '1 day' + TIME '16:00')::TIMESTAMPTZ,
     (CURRENT_DATE + INTERVAL '1 day' + TIME '17:30')::TIMESTAMPTZ,
     'ACTIVE', 'Calculus Introduction')
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- SESSIONS_STAFF
  -- ========================
  INSERT INTO public.sessions_staff (id, session_id, staff_id, type, attended, created_by)
  VALUES
    (gen_random_uuid(), session1_id, '00000000-0000-0000-0000-000000000010', 'MAIN_TUTOR', true, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session2_id, '00000000-0000-0000-0000-000000000011', 'MAIN_TUTOR', true, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session3_id, '00000000-0000-0000-0000-000000000014', 'MAIN_TUTOR', true, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session4_id, '00000000-0000-0000-0000-000000000012', 'MAIN_TUTOR', true, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session5_id, '00000000-0000-0000-0000-000000000010', 'MAIN_TUTOR', false, '00000000-0000-0000-0000-000000000001') -- Upcoming session
  ON CONFLICT DO NOTHING;

  -- ========================
  -- SESSIONS_STUDENTS
  -- ========================
  -- Enroll students in sessions based on their class enrollments
  INSERT INTO public.sessions_students (id, session_id, student_id, planned_absence, is_rescheduled, is_credited, created_by)
  VALUES
    -- Session 1 (Math) - Alice, Bob, Charlie
    (gen_random_uuid(), session1_id, '10000000-0000-0000-0000-000000000001', false, false, false, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session1_id, '10000000-0000-0000-0000-000000000002', false, false, false, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session1_id, '10000000-0000-0000-0000-000000000003', true, false, false, '00000000-0000-0000-0000-000000000001'), -- Planned absence
    
    -- Session 2 (Bio) - Diana, Edward
    (gen_random_uuid(), session2_id, '10000000-0000-0000-0000-000000000004', false, false, false, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session2_id, '10000000-0000-0000-0000-000000000005', false, false, false, '00000000-0000-0000-0000-000000000001'),
    
    -- Session 3 (Chem) - Fiona
    (gen_random_uuid(), session3_id, '10000000-0000-0000-0000-000000000006', false, false, false, '00000000-0000-0000-0000-000000000001'),
    
    -- Session 4 (English) - Hannah, Alice
    (gen_random_uuid(), session4_id, '10000000-0000-0000-0000-000000000008', false, false, false, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session4_id, '10000000-0000-0000-0000-000000000001', true, true, false, '00000000-0000-0000-0000-000000000001'), -- Rescheduled
    
    -- Session 5 (Math - upcoming) - Alice, Bob
    (gen_random_uuid(), session5_id, '10000000-0000-0000-0000-000000000001', false, false, false, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), session5_id, '10000000-0000-0000-0000-000000000002', false, false, false, '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;

END $$;

