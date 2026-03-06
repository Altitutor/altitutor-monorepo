-- Migration: Convert polymorphic notes.note from TEXT to JSONB
-- Description: Store notes as TipTap/ProseMirror JSON for rich text and mentions support
-- Author: AI Assistant
-- Date: 2026-03-06

-- ========================
-- 1. Update extract_text_from_prosemirror_json to handle mention nodes
-- ========================
CREATE OR REPLACE FUNCTION public.extract_text_from_prosemirror_json(json_content JSONB)
RETURNS TEXT AS $$
DECLARE
  result TEXT := '';
  node JSONB;
BEGIN
  -- Handle null or empty content
  IF json_content IS NULL OR json_content = 'null'::jsonb THEN
    RETURN '';
  END IF;

  -- If it's a text node, return the text
  IF json_content->>'type' = 'text' THEN
    RETURN COALESCE(json_content->>'text', '');
  END IF;

  -- If it's a mention node, return the label for text extraction
  IF json_content->>'type' = 'mention' AND json_content ? 'attrs' THEN
    RETURN COALESCE(json_content->'attrs'->>'label', '');
  END IF;

  -- Recursively process content array
  IF json_content ? 'content' AND jsonb_typeof(json_content->'content') = 'array' THEN
    FOR node IN SELECT * FROM jsonb_array_elements(json_content->'content')
    LOOP
      result := result || ' ' || public.extract_text_from_prosemirror_json(node);
    END LOOP;
  END IF;

  RETURN TRIM(result);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ========================
-- 2. Recreate migrate_text_to_tiptap_jsonb (was dropped in 20260217012000)
-- ========================
CREATE OR REPLACE FUNCTION public.migrate_text_to_tiptap_jsonb(val TEXT)
RETURNS JSONB AS $$
BEGIN
  IF val IS NULL OR val = '' THEN
    RETURN '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb;
  END IF;
  
  -- Try to parse as JSON (if it's already JSON from new app versions)
  BEGIN
    IF val ~ '^\s*\{' OR val ~ '^\s*\[' THEN
      RETURN val::jsonb;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    NULL; -- Fall through to wrapping
  END;

  -- Not valid JSON or doesn't look like JSON, wrap it in Tiptap structure
  RETURN jsonb_build_object(
    'type', 'doc', 
    'content', jsonb_build_array(
      jsonb_build_object(
        'type', 'paragraph', 
        'content', jsonb_build_array(
          jsonb_build_object('type', 'text', 'text', val)
        )
      )
    )
  );
END;
$$ LANGUAGE plpgsql;

-- ========================
-- 3. Drop views that depend on notes.note (will recreate after alter)
-- ========================
DROP VIEW IF EXISTS public.vtutor_tutor_log;
DROP VIEW IF EXISTS public.vtutor_notes;

-- ========================
-- 4. Convert notes.note from TEXT to JSONB
-- ========================
ALTER TABLE public.notes
  ALTER COLUMN note TYPE JSONB USING public.migrate_text_to_tiptap_jsonb(note);

ALTER TABLE public.notes
  ALTER COLUMN note SET DEFAULT '{"type":"doc","content":[{"type":"paragraph","content":[]}]}'::jsonb;

-- ========================
-- 5. Recreate vtutor_tutor_log view
-- ========================
CREATE OR REPLACE VIEW public.vtutor_tutor_log
WITH (security_invoker = false)
AS
SELECT 
  tl.id AS tutor_log_id,
  tl.session_id,
  tl.created_at AS tutor_log_created_at,
  tl.updated_at AS tutor_log_updated_at,
  tl.created_by,
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'staff_id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name,
      'role', s.role,
      'status', s.status,
      'availability_monday', s.availability_monday,
      'availability_tuesday', s.availability_tuesday,
      'availability_wednesday', s.availability_wednesday,
      'availability_thursday', s.availability_thursday,
      'availability_friday', s.availability_friday,
      'availability_saturday_am', s.availability_saturday_am,
      'availability_saturday_pm', s.availability_saturday_pm,
      'availability_sunday_am', s.availability_sunday_am,
      'availability_sunday_pm', s.availability_sunday_pm,
      'attended', tlsa.attended,
      'type', tlsa.type
    ))
    FROM public.tutor_logs_staff_attendance tlsa
    JOIN public.staff s ON s.id = tlsa.staff_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS staff_attendance,
  (
    SELECT json_agg(json_build_object(
      'id', tlsa.id,
      'student_id', st.id,
      'first_name', st.first_name,
      'last_name', st.last_name,
      'status', st.status,
      'school', st.school,
      'curriculum', st.curriculum,
      'year_level', st.year_level,
      'availability_monday', st.availability_monday,
      'availability_tuesday', st.availability_tuesday,
      'availability_wednesday', st.availability_wednesday,
      'availability_thursday', st.availability_thursday,
      'availability_friday', st.availability_friday,
      'availability_saturday_am', st.availability_saturday_am,
      'availability_saturday_pm', st.availability_saturday_pm,
      'availability_sunday_am', st.availability_sunday_am,
      'availability_sunday_pm', st.availability_sunday_pm,
      'attended', tlsa.attended
    ))
    FROM public.tutor_logs_student_attendance tlsa
    JOIN public.students st ON st.id = tlsa.student_id
    WHERE tlsa.tutor_log_id = tl.id
  ) AS student_attendance,
  (
    SELECT json_agg(json_build_object(
      'id', tlt.id,
      'topic_id', t.id,
      'topic_name', t.name,
      'topic_index', t.index,
      'parent_id', t.parent_id,
      'subject_id', t.subject_id,
      'student_ids', (
        SELECT json_agg(tlts.student_id)
        FROM public.tutor_logs_topics_students tlts
        WHERE tlts.tutor_logs_topics_id = tlt.id
      )
    ))
    FROM public.tutor_logs_topics tlt
    JOIN public.topics t ON t.id = tlt.topic_id
    WHERE tlt.tutor_log_id = tl.id
  ) AS topics,
  (
    SELECT json_agg(json_build_object(
      'id', tltf.id,
      'topics_files_id', tf.id,
      'topic_id', tf.topic_id,
      'file_id', f.id,
      'filename', f.filename,
      'mimetype', f.mimetype,
      'size_bytes', f.size_bytes,
      'type', tf.type,
      'is_solutions', tf.is_solutions,
      'storage_path', f.storage_path,
      'bucket', f.bucket,
      'student_ids', (
        SELECT json_agg(tltfs.student_id)
        FROM public.tutor_logs_topics_files_students tltfs
        WHERE tltfs.tutor_logs_topics_files_id = tltf.id
      )
    ))
    FROM public.tutor_logs_topics_files tltf
    JOIN public.topics_files tf ON tf.id = tltf.topics_files_id
    JOIN public.files f ON f.id = tf.file_id
    WHERE tltf.tutor_log_id = tl.id
  ) AS files,
  (
    SELECT json_agg(json_build_object(
      'id', n.id,
      'note', n.note,
      'created_at', n.created_at,
      'created_by', n.created_by
    ))
    FROM public.notes n
    WHERE n.target_type = 'tutor_logs'
      AND n.target_id = tl.id
  ) AS notes
FROM public.tutor_logs tl
WHERE 
  tl.created_by = public.current_tutor_id()
  OR
  tl.id IN (
    SELECT tutor_log_id 
    FROM public.tutor_logs_staff_attendance 
    WHERE staff_id = public.current_tutor_id()
  )
  OR
  tl.session_id IN (
    SELECT session_id 
    FROM public.sessions_staff 
    WHERE staff_id = public.current_tutor_id()
  );

GRANT SELECT ON public.vtutor_tutor_log TO authenticated;

-- Recreate vtutor_notes view
CREATE OR REPLACE VIEW public.vtutor_notes
WITH (security_invoker = false)
AS
SELECT 
  n.id,
  n.target_type,
  n.target_id,
  n.note,
  n.created_at,
  n.created_by,
  (
    SELECT json_build_object(
      'id', s.id,
      'first_name', s.first_name,
      'last_name', s.last_name
    )
    FROM public.staff s
    WHERE s.id = n.created_by
  ) AS staff
FROM public.notes n
WHERE 
  (n.target_type = 'sessions' AND n.target_id IN (
    SELECT session_id 
    FROM public.sessions_staff 
    WHERE staff_id = public.current_tutor_id()
  ))
  OR
  (n.target_type = 'tutor_logs' AND n.target_id IN (
    SELECT id
    FROM public.tutor_logs tl
    WHERE 
      tl.created_by = public.current_tutor_id()
      OR
      tl.id IN (
        SELECT tutor_log_id 
        FROM public.tutor_logs_staff_attendance 
        WHERE staff_id = public.current_tutor_id()
      )
      OR
      tl.session_id IN (
        SELECT session_id 
        FROM public.sessions_staff 
        WHERE staff_id = public.current_tutor_id()
      )
  ));

GRANT SELECT ON public.vtutor_notes TO authenticated;

-- ========================
-- 6. Update create_tutor_log to pass JSONB for note column
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
  v_student_was_trial BOOLEAN;
  v_staff_id UUID;
  v_staff_status TEXT;
  v_staff_was_trial BOOLEAN;
  v_staff_attendance_jsonb JSONB;
  v_student_attendance_jsonb JSONB;
  v_topics_jsonb JSONB;
  v_topic_files_jsonb JSONB;
  v_notes_jsonb JSONB;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM sessions WHERE id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Session does not exist');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM staff WHERE id = p_created_by AND status = 'ACTIVE') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or inactive staff member');
  END IF;

  IF EXISTS (SELECT 1 FROM tutor_logs WHERE session_id = p_session_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Tutor log already exists for this session');
  END IF;

  v_staff_attendance_jsonb := COALESCE(p_staff_attendance::JSONB, '[]'::JSONB);
  v_student_attendance_jsonb := COALESCE(p_student_attendance::JSONB, '[]'::JSONB);
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

  -- Create notes: convert plain text to TipTap JSONB
  FOR v_note_item IN SELECT value FROM jsonb_array_elements_text(v_notes_jsonb)
  LOOP
    INSERT INTO notes (id, target_type, target_id, note, created_by)
    VALUES (
      gen_random_uuid(),
      'tutor_logs',
      v_tutor_log_id,
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

COMMENT ON FUNCTION create_tutor_log IS 'Atomically creates a tutor log. Notes column now stores TipTap JSONB.';
