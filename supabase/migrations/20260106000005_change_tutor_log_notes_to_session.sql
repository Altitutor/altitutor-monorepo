-- Migration: Change tutor log notes to attach to session instead of tutor log
-- This ensures notes created during tutor log creation are visible in both admin-web and tutor-web SessionModals
-- Notes will now be attached to the session (target_type='sessions') instead of the tutor log (target_type='tutor_logs')

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

  -- Explicitly cast p_notes to JSONB to handle Supabase serialization
  -- Supabase RPC client may send JavaScript arrays in a format that needs explicit casting
  -- Ensure it's always a valid JSONB array
  IF p_notes IS NULL THEN
    v_notes_jsonb := '[]'::JSONB;
  ELSE
    -- Explicit cast to JSONB - PostgreSQL will handle the conversion
    v_notes_jsonb := p_notes::JSONB;
  END IF;

  -- Start transaction (implicit in function)
  
  -- 1. Create the tutor log
  INSERT INTO tutor_logs (id, session_id, created_by)
  VALUES (gen_random_uuid(), p_session_id, p_created_by)
  RETURNING id INTO v_tutor_log_id;

  -- 2. Create staff attendance records
  FOR v_staff_attendance_item IN SELECT * FROM jsonb_array_elements(p_staff_attendance)
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

  -- 3. Create student attendance records
  FOR v_student_attendance_item IN SELECT * FROM jsonb_array_elements(p_student_attendance)
  LOOP
    INSERT INTO tutor_logs_student_attendance (
      id,
      tutor_log_id,
      student_id,
      attended,
      created_by
    )
    VALUES (
      gen_random_uuid(),
      v_tutor_log_id,
      (v_student_attendance_item->>'studentId')::UUID,
      (v_student_attendance_item->>'attended')::BOOLEAN,
      p_created_by
    )
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  -- 4. Create topic records and topic-student links
  FOR v_topic_item IN SELECT * FROM jsonb_array_elements(p_topics)
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
  FOR v_topic_file_item IN SELECT * FROM jsonb_array_elements(p_topic_files)
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

  -- 6. Create notes - CHANGED: Attach to session instead of tutor log
  -- This ensures notes are visible in both admin-web and tutor-web SessionModals
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
      'sessions',          -- Changed: attach to session instead of tutor log
      p_session_id,       -- Changed: use session ID instead of tutor log ID
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

-- Grant execute permission to authenticated users (RLS policies will handle authorization)
GRANT EXECUTE ON FUNCTION create_tutor_log(UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION create_tutor_log IS 
'Atomically creates a tutor log with all related records (staff attendance, student attendance, topics, topic files, notes).
All operations are performed within a single transaction - either all succeed or all fail.
Returns success status with tutor log ID or error details.
Notes are attached to the session (target_type=''sessions'') to ensure visibility in both admin-web and tutor-web SessionModals.
Updated to explicitly cast p_notes to JSONB to handle Supabase RPC client serialization.';

