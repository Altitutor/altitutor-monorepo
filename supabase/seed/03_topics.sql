-- Seed data for topics and topics_files
-- Depends on: subjects, staff

DO $$
DECLARE
  math_subject_id UUID;
  bio_subject_id UUID;
  chem_subject_id UUID;
  topic1_id UUID := '30000000-0000-0000-0000-000000000001';
  topic2_id UUID := '30000000-0000-0000-0000-000000000002';
  topic3_id UUID := '30000000-0000-0000-0000-000000000003';
  topic4_id UUID := '30000000-0000-0000-0000-000000000004';
  subtopic1_id UUID := '30000000-0000-0000-0000-000000000010';
BEGIN
  -- Get subject IDs
  SELECT id INTO math_subject_id FROM public.subjects WHERE name = 'Mathematical Methods' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO bio_subject_id FROM public.subjects WHERE name = 'Biology' AND year_level = 12 AND curriculum = 'SACE' LIMIT 1;
  SELECT id INTO chem_subject_id FROM public.subjects WHERE name = 'Chemistry' AND year_level = 11 AND curriculum = 'SACE' LIMIT 1;

  -- ========================
  -- TOPICS
  -- ========================
  INSERT INTO public.topics (id, subject_id, name, index, parent_id, created_by)
  VALUES
    (topic1_id, math_subject_id, 'Functions and Graphs', 1, NULL, '00000000-0000-0000-0000-000000000001'),
    (topic2_id, math_subject_id, 'Calculus', 2, NULL, '00000000-0000-0000-0000-000000000001'),
    (topic3_id, bio_subject_id, 'Cell Biology', 1, NULL, '00000000-0000-0000-0000-000000000001'),
    (topic4_id, chem_subject_id, 'Atomic Structure', 1, NULL, '00000000-0000-0000-0000-000000000001'),
    (subtopic1_id, math_subject_id, 'Linear Functions', 1, topic1_id, '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;

  -- ========================
  -- FILES (for topics_files)
  -- ========================
  -- Note: These are placeholder files. In production, these would reference actual storage files.
  INSERT INTO public.files (id, mimetype, filename, size_bytes, metadata, storage_provider, bucket, storage_path, created_by)
  VALUES
    ('40000000-0000-0000-0000-000000000001', 'application/pdf', 'functions_worksheet.pdf', 245760, '{"pages": 5}'::jsonb, 'supabase', 'resources', 'topics/functions_worksheet.pdf', '00000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000002', 'application/pdf', 'functions_answers.pdf', 245760, '{"pages": 5}'::jsonb, 'supabase', 'resources', 'topics/functions_answers.pdf', '00000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000003', 'application/pdf', 'calculus_notes.pdf', 512000, '{"pages": 10}'::jsonb, 'supabase', 'resources', 'topics/calculus_notes.pdf', '00000000-0000-0000-0000-000000000001'),
    ('40000000-0000-0000-0000-000000000004', 'application/pdf', 'cell_biology_test.pdf', 184320, '{"pages": 3}'::jsonb, 'supabase', 'resources', 'topics/cell_biology_test.pdf', '00000000-0000-0000-0000-000000000001')
  ON CONFLICT (id) DO NOTHING;

  -- ========================
  -- TOPICS_FILES
  -- ========================
  INSERT INTO public.topics_files (id, topic_id, type, index, file_id, is_solutions, is_solutions_of_id, created_by)
  VALUES
    -- Functions topic files
    (gen_random_uuid(), topic1_id, 'PRACTICE_QUESTIONS', 1, '40000000-0000-0000-0000-000000000001', false, NULL, '00000000-0000-0000-0000-000000000001'),
    (gen_random_uuid(), topic1_id, 'PRACTICE_QUESTIONS', 1, '40000000-0000-0000-0000-000000000002', true, NULL, '00000000-0000-0000-0000-000000000001'),
    -- Calculus topic files
    (gen_random_uuid(), topic2_id, 'NOTES', 1, '40000000-0000-0000-0000-000000000003', false, NULL, '00000000-0000-0000-0000-000000000001'),
    -- Cell Biology topic files
    (gen_random_uuid(), topic3_id, 'TEST', 1, '40000000-0000-0000-0000-000000000004', false, NULL, '00000000-0000-0000-0000-000000000001')
  ON CONFLICT DO NOTHING;

END $$;

