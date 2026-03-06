-- Seed data for tutor logs and related tables
-- Depends on: sessions, staff, students, topics, topics_files

DO $$
DECLARE
  session1_id UUID := '50000000-0000-0000-0000-000000000001';
  session2_id UUID := '50000000-0000-0000-0000-000000000002';
  topic1_id UUID := '30000000-0000-0000-0000-000000000001';
  topic2_id UUID := '30000000-0000-0000-0000-000000000002';
  topic3_id UUID := '30000000-0000-0000-0000-000000000003';
  tutor_log1_id UUID;
  tutor_log2_id UUID;
  tutor_logs_topics1_id UUID;
  tutor_logs_topics2_id UUID;
  topics_files_id UUID;
  tutor_logs_topics_files_id UUID;
BEGIN
  -- Get topics_files ID
  SELECT id INTO topics_files_id FROM public.topics_files WHERE topic_id = topic1_id LIMIT 1;

  -- Only create tutor logs if sessions exist
  IF EXISTS (SELECT 1 FROM public.sessions WHERE id = session1_id) AND
     EXISTS (SELECT 1 FROM public.sessions WHERE id = session2_id) THEN

    -- ========================
    -- TUTOR_LOGS
    -- ========================
    INSERT INTO public.tutor_logs (id, session_id, created_by)
    VALUES
      (gen_random_uuid(), session1_id, '00000000-0000-0000-0000-000000000010'),
      (gen_random_uuid(), session2_id, '00000000-0000-0000-0000-000000000011')
    ON CONFLICT DO NOTHING;

    -- Get the tutor log IDs we just created
    SELECT id INTO tutor_log1_id FROM public.tutor_logs WHERE session_id = session1_id LIMIT 1;
    SELECT id INTO tutor_log2_id FROM public.tutor_logs WHERE session_id = session2_id LIMIT 1;

    -- Only proceed if tutor logs were created successfully
    IF tutor_log1_id IS NOT NULL AND tutor_log2_id IS NOT NULL THEN

      -- ========================
      -- TUTOR_LOGS_STAFF_ATTENDANCE
      -- ========================
      INSERT INTO public.tutor_logs_staff_attendance (id, tutor_log_id, staff_id, attended, type)
      VALUES
        (gen_random_uuid(), tutor_log1_id, '00000000-0000-0000-0000-000000000010', true, 'MAIN_TUTOR'),
        (gen_random_uuid(), tutor_log2_id, '00000000-0000-0000-0000-000000000011', true, 'MAIN_TUTOR')
      ON CONFLICT DO NOTHING;

      -- ========================
      -- TUTOR_LOGS_STUDENT_ATTENDANCE
      -- ========================
      INSERT INTO public.tutor_logs_student_attendance (id, tutor_log_id, student_id, attended, created_by)
      VALUES
        -- Session 1 attendance
        (gen_random_uuid(), tutor_log1_id, '10000000-0000-0000-0000-000000000001', true, '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), tutor_log1_id, '10000000-0000-0000-0000-000000000002', true, '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), tutor_log1_id, '10000000-0000-0000-0000-000000000003', false, '00000000-0000-0000-0000-000000000010'), -- Absent
        
        -- Session 2 attendance
        (gen_random_uuid(), tutor_log2_id, '10000000-0000-0000-0000-000000000004', true, '00000000-0000-0000-0000-000000000011'),
        (gen_random_uuid(), tutor_log2_id, '10000000-0000-0000-0000-000000000005', true, '00000000-0000-0000-0000-000000000011')
      ON CONFLICT DO NOTHING;

      -- ========================
      -- TUTOR_LOGS_TOPICS
      -- ========================
      INSERT INTO public.tutor_logs_topics (id, tutor_log_id, topic_id, created_by)
      VALUES
        (gen_random_uuid(), tutor_log1_id, topic1_id, '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), tutor_log1_id, topic2_id, '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), tutor_log2_id, topic3_id, '00000000-0000-0000-0000-000000000011')
      ON CONFLICT DO NOTHING;

      -- Get tutor_logs_topics IDs
      SELECT id INTO tutor_logs_topics1_id FROM public.tutor_logs_topics WHERE tutor_log_id = tutor_log1_id AND topic_id = topic1_id LIMIT 1;
      SELECT id INTO tutor_logs_topics2_id FROM public.tutor_logs_topics WHERE tutor_log_id = tutor_log1_id AND topic_id = topic2_id LIMIT 1;

      -- ========================
      -- TUTOR_LOGS_TOPICS_STUDENTS
      -- ========================
      IF tutor_logs_topics1_id IS NOT NULL AND tutor_logs_topics2_id IS NOT NULL THEN
        INSERT INTO public.tutor_logs_topics_students (id, tutor_logs_topics_id, student_id, created_by)
        VALUES
          -- Topic 1 students
          (gen_random_uuid(), tutor_logs_topics1_id, '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010'),
          (gen_random_uuid(), tutor_logs_topics1_id, '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010'),
          -- Topic 2 students
          (gen_random_uuid(), tutor_logs_topics2_id, '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010')
        ON CONFLICT DO NOTHING;
      END IF;

      -- ========================
      -- TUTOR_LOGS_TOPICS_FILES
      -- ========================
      IF topics_files_id IS NOT NULL THEN
        INSERT INTO public.tutor_logs_topics_files (id, tutor_log_id, topics_files_id, created_by)
        VALUES
          (gen_random_uuid(), tutor_log1_id, topics_files_id, '00000000-0000-0000-0000-000000000010')
        ON CONFLICT DO NOTHING;

        -- Get tutor_logs_topics_files ID
        SELECT id INTO tutor_logs_topics_files_id FROM public.tutor_logs_topics_files WHERE tutor_log_id = tutor_log1_id LIMIT 1;

        -- ========================
        -- TUTOR_LOGS_TOPICS_FILES_STUDENTS
        -- ========================
        IF tutor_logs_topics_files_id IS NOT NULL THEN
          INSERT INTO public.tutor_logs_topics_files_students (id, tutor_logs_topics_files_id, student_id, created_by)
          VALUES
            (gen_random_uuid(), tutor_logs_topics_files_id, '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010'),
            (gen_random_uuid(), tutor_logs_topics_files_id, '10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010')
          ON CONFLICT DO NOTHING;
        END IF;
      END IF;

      -- ========================
      -- NOTES
      -- ========================
      INSERT INTO public.notes (id, target_type, target_id, note, created_by)
      VALUES
        (gen_random_uuid(), 'students', '10000000-0000-0000-0000-000000000001', public.migrate_text_to_tiptap_jsonb('Alice is making excellent progress in mathematics. Very engaged in class.'), '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), 'students', '10000000-0000-0000-0000-000000000003', public.migrate_text_to_tiptap_jsonb('Charlie missed the last session. Parent notified.'), '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), 'sessions', session1_id, public.migrate_text_to_tiptap_jsonb('Great session today. Covered functions and graphs thoroughly.'), '00000000-0000-0000-0000-000000000010'),
        (gen_random_uuid(), 'tutor_logs', tutor_log1_id, public.migrate_text_to_tiptap_jsonb('All students participated well. Homework assigned.'), '00000000-0000-0000-0000-000000000010')
      ON CONFLICT DO NOTHING;

    END IF; -- End of tutor_logs existence check

  END IF; -- End of sessions existence check

END $$;

