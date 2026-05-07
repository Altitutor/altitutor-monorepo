-- Migration: CHECK_IN session type, sessions_parents join, tutor_logs_parent_attendance,
--   create_tutor_log parent payload, search_sessions_admin is_extra for non-class sessions

-- ========================
-- 1. SESSION TYPE ENUM
-- ========================
ALTER TYPE public.session_type ADD VALUE IF NOT EXISTS 'CHECK_IN';

-- ========================
-- 2. sessions_parents
-- ========================
CREATE TABLE IF NOT EXISTS public.sessions_parents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.staff(id),
  CONSTRAINT sessions_parents_session_parent_unique UNIQUE (session_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_parents_session_id ON public.sessions_parents(session_id);
CREATE INDEX IF NOT EXISTS idx_sessions_parents_parent_id ON public.sessions_parents(parent_id);

ALTER TABLE public.sessions_parents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to sessions_parents" ON public.sessions_parents;
CREATE POLICY "ADMINSTAFF full access to sessions_parents" ON public.sessions_parents
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 3. tutor_logs_parent_attendance
-- ========================
CREATE TABLE IF NOT EXISTS public.tutor_logs_parent_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tutor_log_id UUID NOT NULL REFERENCES public.tutor_logs(id) ON DELETE CASCADE,
  parent_id UUID NOT NULL REFERENCES public.parents(id) ON DELETE CASCADE,
  attended BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.staff(id),
  CONSTRAINT tutor_logs_parent_attendance_unique UNIQUE (tutor_log_id, parent_id)
);

CREATE INDEX IF NOT EXISTS idx_tutor_logs_parent_attendance_tutor_log_id
  ON public.tutor_logs_parent_attendance(tutor_log_id);
CREATE INDEX IF NOT EXISTS idx_tutor_logs_parent_attendance_parent_id
  ON public.tutor_logs_parent_attendance(parent_id);

DROP TRIGGER IF EXISTS set_updated_at_tutor_logs_parent_attendance ON public.tutor_logs_parent_attendance;
CREATE TRIGGER set_updated_at_tutor_logs_parent_attendance
  BEFORE UPDATE ON public.tutor_logs_parent_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.tutor_logs_parent_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tutors can access parent attendance for their logs" ON public.tutor_logs_parent_attendance;
CREATE POLICY "Tutors can access parent attendance for their logs" ON public.tutor_logs_parent_attendance
  FOR ALL TO authenticated
  USING (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs
      WHERE created_by IN (
        SELECT id FROM public.staff
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  )
  WITH CHECK (
    tutor_log_id IN (
      SELECT id FROM public.tutor_logs
      WHERE created_by IN (
        SELECT id FROM public.staff
        WHERE user_id = auth.uid() AND role = 'TUTOR' AND status = 'ACTIVE'
      )
    )
  );

DROP POLICY IF EXISTS "ADMINSTAFF full access to tutor_logs_parent_attendance" ON public.tutor_logs_parent_attendance;
CREATE POLICY "ADMINSTAFF full access to tutor_logs_parent_attendance" ON public.tutor_logs_parent_attendance
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

-- ========================
-- 4. create_tutor_log — add p_parent_attendance (replace 7-arg overload)
-- ========================
DROP FUNCTION IF EXISTS public.create_tutor_log(UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB);

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

GRANT EXECUTE ON FUNCTION public.create_tutor_log(UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) TO authenticated;

COMMENT ON FUNCTION public.create_tutor_log(UUID, UUID, JSONB, JSONB, JSONB, JSONB, JSONB, JSONB) IS
  'Atomically creates a tutor log including optional parent attendance (meetings).';

-- ========================
-- 5. search_sessions_admin — is_extra for non-CLASS; search by parent name
-- ========================
DROP FUNCTION IF EXISTS search_sessions_admin(
  TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN
);

CREATE OR REPLACE FUNCTION search_sessions_admin(
  p_search TEXT DEFAULT NULL,
  p_range_start TIMESTAMPTZ DEFAULT NULL,
  p_range_end TIMESTAMPTZ DEFAULT NULL,
  p_staff_id UUID DEFAULT NULL,
  p_class_id UUID DEFAULT NULL,
  p_student_id UUID DEFAULT NULL,
  p_admin_shift_id UUID DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_types TEXT[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'start_at',
  p_ascending BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT;
  v_session_ids UUID[];
  v_sessions JSONB;
  v_total_count BIGINT;
  v_session_students JSONB;
  v_session_staff JSONB;
  v_tutor_logs JSONB;
  v_classes_by_id JSONB;
  v_subjects_by_id JSONB;
  v_class_ids UUID[];
  v_subject_ids UUID[];
  v_tutor_log_ids UUID[];
  v_student_ids UUID[];
  v_staff_ids UUID[];
  v_unplanned_student_ids JSONB;
  v_unplanned_staff_ids JSONB;
  v_actual_student_attendance JSONB;
  v_actual_staff_attendance JSONB;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object(
      'sessions', '[]'::jsonb,
      'sessionStudents', '{}'::jsonb,
      'sessionStaff', '{}'::jsonb,
      'tutorLogs', '{}'::jsonb,
      'classesById', '{}'::jsonb,
      'subjectsById', '{}'::jsonb,
      'total', 0
    );
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_session_ids
    FROM (
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_students ss ON ss.session_id = s.id
      JOIN public.students st ON st.id = ss.student_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(st.first_name, ''), COALESCE(st.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_staff sf ON sf.session_id = s.id
      JOIN public.staff stf ON stf.id = sf.staff_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(stf.first_name, ''), COALESCE(stf.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT s.id
      FROM public.sessions s
      JOIN public.sessions_parents sp ON sp.session_id = s.id
      JOIN public.parents p ON p.id = sp.parent_id
      WHERE LOWER(CONCAT_WS(' ', COALESCE(p.first_name, ''), COALESCE(p.last_name, ''))) LIKE '%' || v_search_lower || '%'
      UNION
      SELECT DISTINCT s.id
      FROM public.sessions s
      WHERE LOWER(COALESCE(s.short_name, '')) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(s.long_name, '')) LIKE '%' || v_search_lower || '%'
    ) search_results;
  END IF;

  WITH filtered_sessions AS (
    SELECT s.id, s.type, s.class_id, s.subject_id, s.admin_shift_id, s.start_at, s.end_at, s.status, s.created_at, s.updated_at
    FROM public.sessions s
    WHERE (v_session_ids IS NULL OR (array_length(v_session_ids, 1) > 0 AND s.id = ANY(v_session_ids)))
      AND (p_range_start IS NULL OR s.start_at >= p_range_start)
      AND (p_range_end IS NULL OR s.start_at <= p_range_end)
      AND (p_staff_id IS NULL OR EXISTS (SELECT 1 FROM public.sessions_staff sf WHERE sf.session_id = s.id AND sf.staff_id = p_staff_id))
      AND (p_class_id IS NULL OR s.class_id = p_class_id)
      AND (p_student_id IS NULL OR EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id = s.id AND ss.student_id = p_student_id))
      AND (p_admin_shift_id IS NULL OR s.admin_shift_id = p_admin_shift_id)
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
      AND (p_types IS NULL OR array_length(p_types, 1) IS NULL OR s.type::text = ANY(p_types))
  ),
  ordered_sessions AS (
    SELECT * FROM filtered_sessions
    ORDER BY
      CASE WHEN p_order_by = 'start_at' AND p_ascending THEN start_at END ASC,
      CASE WHEN p_order_by = 'start_at' AND NOT p_ascending THEN start_at END DESC,
      CASE WHEN p_order_by = 'end_at' AND p_ascending THEN end_at END ASC,
      CASE WHEN p_order_by = 'end_at' AND NOT p_ascending THEN end_at END DESC,
      CASE WHEN p_order_by = 'type' AND p_ascending THEN type END ASC,
      CASE WHEN p_order_by = 'type' AND NOT p_ascending THEN type END DESC,
      CASE WHEN p_order_by = 'class_id' AND p_ascending THEN class_id END ASC,
      CASE WHEN p_order_by = 'class_id' AND NOT p_ascending THEN class_id END DESC,
      start_at ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
      'id', id, 'type', type, 'class_id', class_id, 'subject_id', subject_id,
      'admin_shift_id', admin_shift_id, 'start_at', start_at, 'end_at', end_at,
      'status', status, 'created_at', created_at, 'updated_at', updated_at
    )), COUNT(*) OVER()::BIGINT
  INTO v_sessions, v_total_count
  FROM ordered_sessions;

  IF v_sessions IS NULL OR jsonb_array_length(v_sessions) = 0 THEN
    RETURN jsonb_build_object(
      'sessions', '[]'::jsonb, 'sessionStudents', '{}'::jsonb, 'sessionStaff', '{}'::jsonb,
      'tutorLogs', '{}'::jsonb, 'classesById', '{}'::jsonb, 'subjectsById', '{}'::jsonb, 'total', 0
    );
  END IF;

  SELECT ARRAY_AGG((s->>'id')::UUID) INTO v_session_ids FROM jsonb_array_elements(v_sessions) s;

  IF p_include_relationships THEN
    SELECT
      ARRAY_AGG(DISTINCT (s->>'class_id')::UUID) FILTER (WHERE (s->>'class_id') IS NOT NULL),
      ARRAY_AGG(DISTINCT (s->>'subject_id')::UUID) FILTER (WHERE (s->>'subject_id') IS NOT NULL)
    INTO v_class_ids, v_subject_ids
    FROM jsonb_array_elements(v_sessions) s;

    IF v_class_ids IS NOT NULL AND array_length(v_class_ids, 1) > 0 THEN
      SELECT jsonb_object_agg(id::TEXT, row_to_json(c)::jsonb) INTO v_classes_by_id
      FROM public.classes c WHERE c.id = ANY(v_class_ids);
      SELECT ARRAY_AGG(DISTINCT subject_id) FILTER (WHERE subject_id IS NOT NULL) INTO v_subject_ids
      FROM public.classes WHERE id = ANY(v_class_ids) AND subject_id IS NOT NULL;
    END IF;

    IF v_subject_ids IS NOT NULL AND array_length(v_subject_ids, 1) > 0 THEN
      SELECT jsonb_object_agg(id::TEXT, row_to_json(subj)::jsonb) INTO v_subjects_by_id
      FROM public.subjects subj WHERE subj.id = ANY(v_subject_ids);
    END IF;

    SELECT ARRAY_AGG(id) INTO v_tutor_log_ids FROM public.tutor_logs WHERE session_id = ANY(v_session_ids);

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH student_attendance_by_session AS (
        SELECT tl.session_id,
          jsonb_object_agg(tlsa.student_id::TEXT, jsonb_build_object('attended', tlsa.attended, 'was_trial', tlsa.was_trial)) as attendance_map
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tlsa.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map) INTO v_actual_student_attendance FROM student_attendance_by_session;

      WITH staff_attendance_by_session AS (
        SELECT tl.session_id,
          jsonb_object_agg(tlsf.staff_id::TEXT, jsonb_build_object('attended', tlsf.attended, 'type', tlsf.type, 'was_trial', tlsf.was_trial)) as attendance_map
        FROM public.tutor_logs_staff_attendance tlsf
        JOIN public.tutor_logs tl ON tl.id = tlsf.tutor_log_id
        WHERE tlsf.tutor_log_id = ANY(v_tutor_log_ids)
        GROUP BY tl.session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, attendance_map) INTO v_actual_staff_attendance FROM staff_attendance_by_session;
    END IF;

    WITH invoice_status_per_student AS (
      SELECT DISTINCT ON (ii.sessions_students_id)
        ii.sessions_students_id,
        inv.status as invoice_status,
        inv.paid_at as invoice_paid_at,
        inv.refunded_at as invoice_refunded_at,
        inv.refunded_via_cn_at as invoice_refunded_via_cn_at,
        inv.credited_at as invoice_credited_at
      FROM public.invoice_items ii
      JOIN public.invoices inv ON inv.id = ii.invoice_id
      WHERE ii.sessions_students_id IN (SELECT id FROM public.sessions_students WHERE session_id = ANY(v_session_ids))
        AND ii.deleted_at IS NULL
        AND inv.deleted_at IS NULL
      ORDER BY ii.sessions_students_id, inv.created_at DESC
    ),
    session_students_with_invoice AS (
      SELECT ss.session_id, ss.id as sessions_students_id, st.id as student_id, st.first_name, st.last_name, st.status,
        st.curriculum, st.year_level, st.school,
        COALESCE(ss.planned_absence, false) as planned_absence, COALESCE(ss.was_trial, false) as was_trial,
        COALESCE(ss.is_rescheduled, false) as is_rescheduled, COALESCE(ss.is_credited, false) as is_credited,
        CASE WHEN rs.id IS NULL THEN NULL ELSE jsonb_build_object('session', jsonb_build_object('id', rs.id, 'start_at', rs.start_at, 'class', CASE WHEN rc.id IS NULL THEN NULL ELSE jsonb_build_object('start_time', rc.start_time) END)) END as rescheduled_session,
        COALESCE((v_actual_student_attendance->ss.session_id::TEXT->st.id::TEXT->>'attended')::boolean, NULL) as actual_attended,
        COALESCE((v_actual_student_attendance->ss.session_id::TEXT->st.id::TEXT->>'was_trial')::boolean, NULL) as actual_was_trial,
        CASE WHEN iss.invoice_status IS NOT NULL THEN jsonb_build_object(
          'status', iss.invoice_status,
          'paid_at', iss.invoice_paid_at,
          'refunded_at', iss.invoice_refunded_at,
          'refunded_via_cn_at', iss.invoice_refunded_via_cn_at,
          'credited_at', iss.invoice_credited_at
        ) ELSE NULL END as invoice_status_payload,
        CASE
          WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
          WHEN s.class_id IS NULL AND s.type IS DISTINCT FROM 'CLASS'::public.session_type THEN true
          ELSE false
        END as is_extra
      FROM public.sessions_students ss
      JOIN public.students st ON st.id = ss.student_id
      JOIN public.sessions s ON s.id = ss.session_id
      LEFT JOIN invoice_status_per_student iss ON iss.sessions_students_id = ss.id
      LEFT JOIN public.sessions_students rss ON rss.id = ss.rescheduled_sessions_students_id
      LEFT JOIN public.sessions rs ON rs.id = rss.session_id
      LEFT JOIN public.classes rc ON rc.id = rs.class_id
      LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id AND cs.student_id = ss.student_id AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      WHERE ss.session_id = ANY(v_session_ids)
    ),
    session_students_aggregated AS (
      SELECT session_id, jsonb_agg(jsonb_build_object(
        'id', student_id, 'first_name', first_name, 'last_name', last_name, 'status', status, 'curriculum', curriculum,
        'year_level', year_level, 'school', school, 'planned_absence', planned_absence, 'was_trial', was_trial,
        'is_rescheduled', is_rescheduled, 'is_credited', is_credited, 'rescheduled_session', rescheduled_session,
        'actual_attended', actual_attended, 'actual_was_trial', actual_was_trial, 'sessions_students_id', sessions_students_id,
        'invoice_status_payload', invoice_status_payload, 'is_extra', is_extra
      )) as students
      FROM session_students_with_invoice GROUP BY session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, students) INTO v_session_students FROM session_students_aggregated;

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH unplanned_students AS (
        SELECT DISTINCT tl.session_id, tlsa.student_id, tlsa.attended, tlsa.was_trial
        FROM public.tutor_logs_student_attendance tlsa
        JOIN public.tutor_logs tl ON tl.id = tlsa.tutor_log_id
        WHERE tl.session_id = ANY(v_session_ids)
          AND NOT EXISTS (SELECT 1 FROM public.sessions_students ss WHERE ss.session_id = tl.session_id AND ss.student_id = tlsa.student_id)
      ),
      unplanned_student_details AS (
        SELECT us.session_id, st.id, st.first_name, st.last_name, st.status, st.curriculum, st.year_level, st.school, us.attended, us.was_trial,
          CASE
            WHEN s.class_id IS NOT NULL AND cs.id IS NULL THEN true
            WHEN s.class_id IS NULL AND s.type IS DISTINCT FROM 'CLASS'::public.session_type THEN true
            ELSE false
          END as is_extra
        FROM unplanned_students us
        JOIN public.students st ON st.id = us.student_id
        JOIN public.sessions s ON s.id = us.session_id
        LEFT JOIN public.classes_students cs ON cs.class_id = s.class_id AND cs.student_id = us.student_id AND (cs.unenrolled_at IS NULL OR cs.unenrolled_at > s.start_at)
      ),
      unplanned_students_aggregated AS (
        SELECT session_id, jsonb_agg(jsonb_build_object(
          'id', id, 'first_name', first_name, 'last_name', last_name, 'status', status, 'curriculum', curriculum,
          'year_level', year_level, 'school', school, 'planned_absence', true, 'was_trial', was_trial,
          'is_rescheduled', false, 'is_credited', false, 'rescheduled_session', NULL,
          'actual_attended', attended, 'actual_was_trial', was_trial, 'sessions_students_id', NULL,
          'invoice_status_payload', NULL, 'is_extra', is_extra
        )) as students
        FROM unplanned_student_details GROUP BY session_id
      )
      SELECT jsonb_object_agg(session_id::TEXT, students) INTO v_unplanned_student_ids FROM unplanned_students_aggregated;
      IF v_unplanned_student_ids IS NOT NULL THEN
        SELECT jsonb_object_agg(k, COALESCE(v_session_students->k, '[]'::jsonb) || COALESCE(v_unplanned_student_ids->k, '[]'::jsonb))
        INTO v_session_students
        FROM (SELECT DISTINCT k FROM jsonb_object_keys(COALESCE(v_session_students, '{}'::jsonb) || COALESCE(v_unplanned_student_ids, '{}'::jsonb)) k) all_keys;
      END IF;
    END IF;

    WITH session_staff_aggregated AS (
      SELECT sf.session_id,
        jsonb_agg(
          jsonb_build_object(
            'id', stf.id,
            'sessions_staff_id', sf.id,
            'first_name', stf.first_name,
            'last_name', stf.last_name,
            'role', stf.role,
            'status', stf.status,
            'planned_absence', COALESCE(sf.planned_absence, false),
            'was_trial', COALESCE(sf.was_trial, false),
            'is_swapped', COALESCE(sf.is_swapped, false),
            'swapped_staff', CASE WHEN swapped_stf.id IS NULL THEN NULL ELSE jsonb_build_object('id', swapped_stf.id, 'first_name', swapped_stf.first_name, 'last_name', swapped_stf.last_name) END,
            'actual_attended', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'attended')::boolean, NULL),
            'actual_was_trial', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'was_trial')::boolean, NULL),
            'actual_type', COALESCE((v_actual_staff_attendance->sf.session_id::TEXT->stf.id::TEXT->>'type'), NULL),
            'is_swapped_in', EXISTS (SELECT 1 FROM public.sessions_staff other_sf WHERE other_sf.swapped_sessions_staff_id = sf.id)
          )
        ) as staff
      FROM public.sessions_staff sf
      JOIN public.staff stf ON stf.id = sf.staff_id
      LEFT JOIN public.sessions_staff swapped_sf ON swapped_sf.id = sf.swapped_sessions_staff_id
      LEFT JOIN public.staff swapped_stf ON swapped_stf.id = sf.staff_id
      WHERE sf.session_id = ANY(v_session_ids)
      GROUP BY sf.session_id
    )
    SELECT jsonb_object_agg(session_id::TEXT, staff) INTO v_session_staff FROM session_staff_aggregated;

    IF v_tutor_log_ids IS NOT NULL AND array_length(v_tutor_log_ids, 1) > 0 THEN
      WITH tutor_logs_with_creator AS (
        SELECT tl.session_id,
          jsonb_build_object(
            'id', tl.id, 'created_by', tl.created_by,
            'created_by_name', jsonb_build_object('first_name', COALESCE(stf.first_name, ''), 'last_name', COALESCE(stf.last_name, ''))
          ) as log_data
        FROM public.tutor_logs tl
        LEFT JOIN public.staff stf ON stf.id = tl.created_by
        WHERE tl.id = ANY(v_tutor_log_ids)
      )
      SELECT jsonb_object_agg(session_id::TEXT, log_data) INTO v_tutor_logs FROM tutor_logs_with_creator;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'sessions', COALESCE(v_sessions, '[]'::jsonb),
    'sessionStudents', COALESCE(v_session_students, '{}'::jsonb),
    'sessionStaff', COALESCE(v_session_staff, '{}'::jsonb),
    'tutorLogs', COALESCE(v_tutor_logs, '{}'::jsonb),
    'classesById', COALESCE(v_classes_by_id, '{}'::jsonb),
    'subjectsById', COALESCE(v_subjects_by_id, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_sessions_admin(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID, UUID, UUID, UUID, TEXT[], TEXT[], BOOLEAN, INTEGER, INTEGER, TEXT, BOOLEAN) IS
  'Search sessions. Class sessions: extra = not enrolled. Classless meetings: all students extra for removal UX. Search includes linked parent names.';
