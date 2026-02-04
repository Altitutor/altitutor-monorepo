-- Migration: Add was_trial tracking to attendance tables
-- Description:
--  - Add was_trial BOOLEAN column to sessions_students table
--  - Add was_trial BOOLEAN column to tutor_logs_student_attendance table
--  - Create triggers to auto-populate was_trial when records are created
--  - Update create_tutor_log function to set was_trial when inserting student attendance
--  - Backfill existing data using activity_events or current student status
-- Purpose: Track whether a student was TRIAL at the time of planned/actual attendance

-- ========================
-- ADD was_trial TO sessions_students
-- ========================
ALTER TABLE public.sessions_students
  ADD COLUMN IF NOT EXISTS was_trial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_sessions_students_was_trial ON public.sessions_students(was_trial);

COMMENT ON COLUMN public.sessions_students.was_trial IS 
  'Indicates whether the student was TRIAL status at the time they were added to this session (planned attendance)';

-- ========================
-- ADD was_trial TO tutor_logs_student_attendance
-- ========================
ALTER TABLE public.tutor_logs_student_attendance
  ADD COLUMN IF NOT EXISTS was_trial BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_tutor_logs_student_attendance_was_trial ON public.tutor_logs_student_attendance(was_trial);

COMMENT ON COLUMN public.tutor_logs_student_attendance.was_trial IS 
  'Indicates whether the student was TRIAL status at the time attendance was logged (actual attendance)';

-- ========================
-- CREATE TRIGGER FUNCTION FOR sessions_students
-- ========================
CREATE OR REPLACE FUNCTION public.set_sessions_students_was_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_status TEXT;
BEGIN
  -- Only set on INSERT or if was_trial is being set to FALSE (default)
  -- This allows manual override by explicitly setting was_trial
  IF TG_OP = 'UPDATE' AND OLD.was_trial IS NOT NULL AND NEW.was_trial != OLD.was_trial THEN
    -- User is explicitly changing was_trial, don't override
    RETURN NEW;
  END IF;

  -- Get current student status
  SELECT status INTO v_student_status
  FROM public.students
  WHERE id = NEW.student_id;

  -- Set was_trial based on student status
  IF v_student_status = 'TRIAL' THEN
    NEW.was_trial := TRUE;
  ELSE
    NEW.was_trial := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_sessions_students_was_trial ON public.sessions_students;
CREATE TRIGGER trigger_sessions_students_was_trial
BEFORE INSERT OR UPDATE ON public.sessions_students
FOR EACH ROW 
EXECUTE FUNCTION public.set_sessions_students_was_trial();

-- ========================
-- CREATE TRIGGER FUNCTION FOR tutor_logs_student_attendance
-- ========================
CREATE OR REPLACE FUNCTION public.set_tutor_logs_student_attendance_was_trial()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_student_status TEXT;
BEGIN
  -- Only set on INSERT or if was_trial is being set to FALSE (default)
  -- This allows manual override by explicitly setting was_trial
  IF TG_OP = 'UPDATE' AND OLD.was_trial IS NOT NULL AND NEW.was_trial != OLD.was_trial THEN
    -- User is explicitly changing was_trial, don't override
    RETURN NEW;
  END IF;

  -- Get current student status
  SELECT status INTO v_student_status
  FROM public.students
  WHERE id = NEW.student_id;

  -- Set was_trial based on student status
  IF v_student_status = 'TRIAL' THEN
    NEW.was_trial := TRUE;
  ELSE
    NEW.was_trial := FALSE;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_tutor_logs_student_attendance_was_trial ON public.tutor_logs_student_attendance;
CREATE TRIGGER trigger_tutor_logs_student_attendance_was_trial
BEFORE INSERT OR UPDATE ON public.tutor_logs_student_attendance
FOR EACH ROW 
EXECUTE FUNCTION public.set_tutor_logs_student_attendance_was_trial();

-- ========================
-- UPDATE create_tutor_log FUNCTION
-- ========================
CREATE OR REPLACE FUNCTION create_tutor_log(
  p_session_id UUID,
  p_created_by UUID,
  p_staff_attendance JSONB DEFAULT '[]'::JSONB,
  p_student_attendance JSONB DEFAULT '[]'::JSONB,
  p_topics JSONB DEFAULT '[]'::JSONB,
  p_topic_files JSONB DEFAULT '[]'::JSONB,
  p_notes JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_topic_id UUID;
  v_topic_file_id UUID;
  v_staff_attendance_item JSONB;
  v_student_attendance_item JSONB;
  v_topic_item JSONB;
  v_topic_file_item JSONB;
  v_note_item TEXT;
  v_student_id UUID;
  v_student_status TEXT;
  v_was_trial BOOLEAN;
  -- Variables to hold properly cast JSONB values
  v_staff_attendance_jsonb JSONB;
  v_student_attendance_jsonb JSONB;
  v_topics_jsonb JSONB;
  v_topic_files_jsonb JSONB;
  v_notes_jsonb JSONB;
BEGIN
  -- Validate that session exists
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Session does not exist'
    );
  END IF;

  -- Validate that staff exists and is active
  IF NOT EXISTS (
    SELECT 1 FROM staff 
    WHERE id = p_created_by 
    AND status = 'ACTIVE'
  ) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid or inactive staff member'
    );
  END IF;

  -- Check if tutor log already exists for this session
  IF EXISTS (SELECT 1 FROM tutor_logs WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Tutor log already exists for this session'
    );
  END IF;

  -- Explicitly cast all JSONB parameters to handle Supabase serialization
  IF p_staff_attendance IS NULL THEN
    v_staff_attendance_jsonb := '[]'::JSONB;
  ELSE
    v_staff_attendance_jsonb := p_staff_attendance::JSONB;
  END IF;

  IF p_student_attendance IS NULL THEN
    v_student_attendance_jsonb := '[]'::JSONB;
  ELSE
    v_student_attendance_jsonb := p_student_attendance::JSONB;
  END IF;

  IF p_topics IS NULL THEN
    v_topics_jsonb := '[]'::JSONB;
  ELSE
    v_topics_jsonb := p_topics::JSONB;
  END IF;

  IF p_topic_files IS NULL THEN
    v_topic_files_jsonb := '[]'::JSONB;
  ELSE
    v_topic_files_jsonb := p_topic_files::JSONB;
  END IF;

  IF p_notes IS NULL THEN
    v_notes_jsonb := '[]'::JSONB;
  ELSE
    v_notes_jsonb := p_notes::JSONB;
  END IF;

  -- Start transaction (implicit in function)
  
  -- 1. Create the tutor log
  INSERT INTO tutor_logs (id, session_id, created_by)
  VALUES (gen_random_uuid(), p_session_id, p_created_by)
  RETURNING id INTO v_tutor_log_id;

  -- 2. Create staff attendance records
  FOR v_staff_attendance_item IN SELECT * FROM jsonb_array_elements(v_staff_attendance_jsonb)
  LOOP
    INSERT INTO tutor_logs_staff_attendance (
      id,
      tutor_log_id,
      staff_id,
      attended,
      type
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_staff_attendance_item->>'staffId')::UUID,
      (v_staff_attendance_item->>'attended')::BOOLEAN,
      v_staff_attendance_item->>'type'
    )
    ON CONFLICT (tutor_log_id, staff_id) DO NOTHING;
  END LOOP;

  -- 3. Create student attendance records with was_trial
  FOR v_student_attendance_item IN SELECT * FROM jsonb_array_elements(v_student_attendance_jsonb)
  LOOP
    v_student_id := (v_student_attendance_item->>'studentId')::UUID;
    
    -- Get student status to determine was_trial
    SELECT status INTO v_student_status
    FROM students
    WHERE id = v_student_id;
    
    -- Set was_trial based on current student status
    v_was_trial := (v_student_status = 'TRIAL');
    
    INSERT INTO tutor_logs_student_attendance (
      id,
      tutor_log_id,
      student_id,
      attended,
      was_trial,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      v_student_id,
      (v_student_attendance_item->>'attended')::BOOLEAN,
      v_was_trial,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  -- 4. Create topic records and topic-student links
  FOR v_topic_item IN SELECT * FROM jsonb_array_elements(v_topics_jsonb)
  LOOP
    -- Insert topic record
    INSERT INTO tutor_logs_topics (
      id,
      tutor_log_id,
      topic_id,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_item->>'topicId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topic_id) DO UPDATE SET id = tutor_logs_topics.id
    RETURNING id INTO v_topic_id;

    -- If no return (shouldn't happen with DO UPDATE), get existing record
    IF v_topic_id IS NULL THEN
      SELECT id INTO v_topic_id
      FROM tutor_logs_topics
      WHERE tutor_log_id = v_tutor_log_id
      AND topic_id = (v_topic_item->>'topicId')::UUID;
    END IF;

    -- Insert topic-student links
    FOR v_student_id IN 
      SELECT value::text::UUID 
      FROM jsonb_array_elements_text(v_topic_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_students (
        id,
        tutor_logs_topics_id,
        student_id,
        created_by
      )
      VALUES (
        gen_random_uuid(),
        v_topic_id,
        v_student_id,
        p_created_by
      )
      ON CONFLICT (tutor_logs_topics_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 5. Create topic file records and topic file-student links
  FOR v_topic_file_item IN SELECT * FROM jsonb_array_elements(v_topic_files_jsonb)
  LOOP
    -- Insert topic file record
    INSERT INTO tutor_logs_topics_files (
      id,
      tutor_log_id,
      topics_files_id,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_topic_file_item->>'topicsFilesId')::UUID,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, topics_files_id) DO UPDATE SET id = tutor_logs_topics_files.id
    RETURNING id INTO v_topic_file_id;

    -- If no return (shouldn't happen with DO UPDATE), get existing record
    IF v_topic_file_id IS NULL THEN
      SELECT id INTO v_topic_file_id
      FROM tutor_logs_topics_files
      WHERE tutor_log_id = v_tutor_log_id
      AND topics_files_id = (v_topic_file_item->>'topicsFilesId')::UUID;
    END IF;

    -- Insert topic file-student links
    FOR v_student_id IN 
      SELECT value::text::UUID 
      FROM jsonb_array_elements_text(v_topic_file_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_files_students (
        id,
        tutor_logs_topics_files_id,
        student_id,
        created_by
      )
      VALUES (
        gen_random_uuid(),
        v_topic_file_id,
        v_student_id,
        p_created_by
      )
      ON CONFLICT (tutor_logs_topics_files_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  -- 6. Create notes using the explicitly cast JSONB variable
  FOR v_note_item IN SELECT value FROM jsonb_array_elements_text(v_notes_jsonb)
  LOOP
    INSERT INTO notes (
      id,
      target_type,
      target_id,
      note,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      'tutor_logs',
      v_tutor_log_id,
      v_note_item,
      p_created_by
    );
  END LOOP;

  -- Return success with tutor log ID
  RETURN jsonb_build_object(
    'success', true,
    'tutor_log_id', v_tutor_log_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'detail', SQLSTATE
    );
END;
$$;

-- ========================
-- BACKFILL EXISTING DATA
-- ========================
-- Backfill sessions_students.was_trial
-- Strategy: Use activity_events to find when student status changed from TRIAL to ACTIVE
-- For records where session was before status change, mark as TRIAL
-- Otherwise, use current student status

UPDATE public.sessions_students ss
SET was_trial = CASE
  -- If student is currently TRIAL, they were TRIAL
  WHEN EXISTS (
    SELECT 1 FROM public.students s 
    WHERE s.id = ss.student_id AND s.status = 'TRIAL'
  ) THEN TRUE
  -- If student is currently ACTIVE, check if they were TRIAL during the session
  WHEN EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.sessions sess ON sess.id = ss.session_id
    WHERE s.id = ss.student_id 
    AND s.status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM public.activity_events ae
      WHERE ae.entity_type = 'students'
      AND ae.entity_id = s.id
      AND ae.changed_fields ? 'status'
      AND (ae.changed_fields->'status'->>'old')::TEXT = 'TRIAL'
      AND (ae.changed_fields->'status'->>'new')::TEXT = 'ACTIVE'
      AND ae.performed_at > COALESCE(sess.end_at, sess.start_at)
    )
  ) THEN TRUE
  -- Otherwise, not TRIAL
  ELSE FALSE
END
WHERE ss.was_trial = FALSE; -- Only update records that haven't been set yet

-- Backfill tutor_logs_student_attendance.was_trial
-- Strategy: Use activity_events to find when student status changed from TRIAL to ACTIVE
-- For records where tutor log was created before status change, mark as TRIAL
-- Otherwise, use current student status

UPDATE public.tutor_logs_student_attendance tlsa
SET was_trial = CASE
  -- If student is currently TRIAL, they were TRIAL
  WHEN EXISTS (
    SELECT 1 FROM public.students s 
    WHERE s.id = tlsa.student_id AND s.status = 'TRIAL'
  ) THEN TRUE
  -- If student is currently ACTIVE, check if they were TRIAL when tutor log was created
  WHEN EXISTS (
    SELECT 1 FROM public.students s
    JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
    WHERE s.id = tlsa.student_id 
    AND s.status = 'ACTIVE'
    AND EXISTS (
      SELECT 1 FROM public.activity_events ae
      WHERE ae.entity_type = 'students'
      AND ae.entity_id = s.id
      AND ae.changed_fields ? 'status'
      AND (ae.changed_fields->'status'->>'old')::TEXT = 'TRIAL'
      AND (ae.changed_fields->'status'->>'new')::TEXT = 'ACTIVE'
      AND ae.performed_at > tl.created_at
    )
  ) THEN TRUE
  -- Otherwise, not TRIAL
  ELSE FALSE
END
WHERE tlsa.was_trial = FALSE; -- Only update records that haven't been set yet

-- ========================
-- COMMENTS
-- ========================
COMMENT ON FUNCTION public.set_sessions_students_was_trial IS 
  'Trigger function to automatically set was_trial based on student status when sessions_students record is created';

COMMENT ON FUNCTION public.set_tutor_logs_student_attendance_was_trial IS 
  'Trigger function to automatically set was_trial based on student status when tutor_logs_student_attendance record is created';
