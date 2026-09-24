-- Migration: Restore auth context in create_tutor_log for activity_events.performed_by
-- Description: create_tutor_log is called with the service role, so auth.uid() is null
--   unless we set request.jwt.claim.sub from p_created_by's user_id. Later tutor-log
--   migrations dropped that set_config, causing activity feeds to show "Unknown".

CREATE OR REPLACE FUNCTION public.create_tutor_log(
  p_session_id UUID,
  p_created_by UUID,
  p_staff_attendance JSONB DEFAULT '[]'::JSONB,
  p_student_attendance JSONB DEFAULT '[]'::JSONB,
  p_topics JSONB DEFAULT '[]'::JSONB,
  p_topic_files JSONB DEFAULT '[]'::JSONB,
  p_notes JSONB DEFAULT '[]'::JSONB,
  p_parent_attendance JSONB DEFAULT '[]'::JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tutor_log_id UUID;
  v_topic_id UUID;
  v_topic_file_id UUID;
  v_staff_attendance_item JSONB;
  v_student_attendance_item JSONB;
  v_parent_attendance_item JSONB;
  v_topic_item JSONB;
  v_topic_file_item JSONB;
  v_note_item TEXT;
  v_student_id UUID;
  v_student_status TEXT;
  v_student_was_trial BOOLEAN;
  v_staff_id UUID;
  v_staff_status TEXT;
  v_staff_was_trial BOOLEAN;
  v_parent_id UUID;
  v_staff_attendance_jsonb JSONB;
  v_student_attendance_jsonb JSONB;
  v_parent_attendance_jsonb JSONB;
  v_topics_jsonb JSONB;
  v_topic_files_jsonb JSONB;
  v_notes_jsonb JSONB;
  v_created_by_user_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session does not exist');
  END IF;

  SELECT user_id INTO v_created_by_user_id
  FROM staff
  WHERE id = p_created_by
    AND status = 'ACTIVE';

  IF v_created_by_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive staff member');
  END IF;

  -- Service-role callers have no JWT; set sub so auth.uid()/current_staff_id() resolve
  -- for activity_events triggers during this transaction.
  PERFORM set_config('request.jwt.claim.sub', v_created_by_user_id::text, true);

  IF EXISTS (SELECT 1 FROM tutor_logs WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tutor log already exists for this session');
  END IF;

  v_staff_attendance_jsonb := COALESCE(p_staff_attendance::JSONB, '[]'::JSONB);
  v_student_attendance_jsonb := COALESCE(p_student_attendance::JSONB, '[]'::JSONB);
  v_parent_attendance_jsonb := COALESCE(p_parent_attendance::JSONB, '[]'::JSONB);
  v_topics_jsonb := COALESCE(p_topics::JSONB, '[]'::JSONB);
  v_topic_files_jsonb := COALESCE(p_topic_files::JSONB, '[]'::JSONB);
  v_notes_jsonb := COALESCE(p_notes::JSONB, '[]'::JSONB);

  INSERT INTO tutor_logs (id, session_id, created_by)
  VALUES (gen_random_uuid(), p_session_id, p_created_by)
  RETURNING id INTO v_tutor_log_id;

  FOR v_staff_attendance_item IN SELECT * FROM jsonb_array_elements(v_staff_attendance_jsonb)
  LOOP
    v_staff_id := (v_staff_attendance_item->>'staffId')::UUID;
    SELECT status INTO v_staff_status FROM staff WHERE id = v_staff_id;
    v_staff_was_trial := (v_staff_status = 'TRIAL');
    INSERT INTO tutor_logs_staff_attendance (id, tutor_log_id, staff_id, attended, type, was_trial)
    VALUES (gen_random_uuid(), v_tutor_log_id, v_staff_id, (v_staff_attendance_item->>'attended')::BOOLEAN, v_staff_attendance_item->>'type', v_staff_was_trial)
    ON CONFLICT (tutor_log_id, staff_id) DO NOTHING;
  END LOOP;

  FOR v_student_attendance_item IN SELECT * FROM jsonb_array_elements(v_student_attendance_jsonb)
  LOOP
    v_student_id := (v_student_attendance_item->>'studentId')::UUID;
    SELECT status INTO v_student_status FROM students WHERE id = v_student_id;
    v_student_was_trial := (v_student_status = 'TRIAL');
    INSERT INTO tutor_logs_student_attendance (id, tutor_log_id, student_id, attended, was_trial, created_by)
    VALUES (gen_random_uuid(), v_tutor_log_id, v_student_id, (v_student_attendance_item->>'attended')::BOOLEAN, v_student_was_trial, p_created_by)
    ON CONFLICT (tutor_log_id, student_id) DO NOTHING;
  END LOOP;

  FOR v_parent_attendance_item IN SELECT * FROM jsonb_array_elements(v_parent_attendance_jsonb)
  LOOP
    v_parent_id := (v_parent_attendance_item->>'parentId')::UUID;
    INSERT INTO tutor_logs_parent_attendance (id, tutor_log_id, parent_id, attended, created_by)
    VALUES (gen_random_uuid(), v_tutor_log_id, v_parent_id, (v_parent_attendance_item->>'attended')::BOOLEAN, p_created_by)
    ON CONFLICT (tutor_log_id, parent_id) DO NOTHING;
  END LOOP;

  FOR v_topic_item IN SELECT * FROM jsonb_array_elements(v_topics_jsonb)
  LOOP
    INSERT INTO tutor_logs_topics (id, tutor_log_id, topic_id, created_by)
    VALUES (gen_random_uuid(), v_tutor_log_id, (v_topic_item->>'topicId')::UUID, p_created_by)
    ON CONFLICT (tutor_log_id, topic_id) DO UPDATE SET id = tutor_logs_topics.id
    RETURNING id INTO v_topic_id;
    IF v_topic_id IS NULL THEN
      SELECT id INTO v_topic_id FROM tutor_logs_topics WHERE tutor_log_id = v_tutor_log_id AND topic_id = (v_topic_item->>'topicId')::UUID;
    END IF;
    FOR v_student_id IN SELECT value::text::UUID FROM jsonb_array_elements_text(v_topic_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_students (id, tutor_logs_topics_id, student_id, created_by)
      VALUES (gen_random_uuid(), v_topic_id, v_student_id, p_created_by)
      ON CONFLICT (tutor_logs_topics_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  FOR v_topic_file_item IN SELECT * FROM jsonb_array_elements(v_topic_files_jsonb)
  LOOP
    INSERT INTO tutor_logs_topics_files (id, tutor_log_id, topics_files_id, created_by)
    VALUES (gen_random_uuid(), v_tutor_log_id, (v_topic_file_item->>'topicsFilesId')::UUID, p_created_by)
    ON CONFLICT (tutor_log_id, topics_files_id) DO UPDATE SET id = tutor_logs_topics_files.id
    RETURNING id INTO v_topic_file_id;
    IF v_topic_file_id IS NULL THEN
      SELECT id INTO v_topic_file_id FROM tutor_logs_topics_files WHERE tutor_log_id = v_tutor_log_id AND topics_files_id = (v_topic_file_item->>'topicsFilesId')::UUID;
    END IF;
    FOR v_student_id IN SELECT value::text::UUID FROM jsonb_array_elements_text(v_topic_file_item->'studentIds')
    LOOP
      INSERT INTO tutor_logs_topics_files_students (id, tutor_logs_topics_files_id, student_id, created_by)
      VALUES (gen_random_uuid(), v_topic_file_id, v_student_id, p_created_by)
      ON CONFLICT (tutor_logs_topics_files_id, student_id) DO NOTHING;
    END LOOP;
  END LOOP;

  FOR v_note_item IN SELECT value FROM jsonb_array_elements_text(v_notes_jsonb)
  LOOP
    INSERT INTO notes (id, target_type, target_id, note, created_by)
    VALUES (
      gen_random_uuid(),
      'sessions',
      p_session_id,
      public.migrate_text_to_tiptap_jsonb(v_note_item),
      p_created_by
    );
  END LOOP;

  RETURN jsonb_build_object('success', true, 'tutor_log_id', v_tutor_log_id);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM, 'detail', SQLSTATE);
END;
$$;

COMMENT ON FUNCTION public.create_tutor_log(UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) IS
  'Atomically creates a tutor log; sets JWT sub from p_created_by so activity_events.performed_by is captured under service-role callers.';
