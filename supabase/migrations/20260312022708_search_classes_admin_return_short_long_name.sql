-- Migration: Return short_name and long_name from search_classes_admin
-- So the frontend can display class names from DB without building from subject/class parts.

CREATE OR REPLACE FUNCTION search_classes_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_student_search BOOLEAN DEFAULT FALSE,
  p_exclude_staff_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'day_of_week',
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
  v_class_ids UUID[];
  v_classes JSONB;
  v_total_count BIGINT;
  v_class_subjects JSONB;
  v_class_students JSONB;
  v_class_staff JSONB;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('classes', '[]'::jsonb, 'classSubjects', '{}'::jsonb, 'classStudents', '{}'::jsonb, 'classStaff', '{}'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL ELSE LOWER(TRIM(p_search)) END;

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_class_ids
    FROM classes c
    WHERE LOWER(COALESCE(c.short_name, '')) LIKE '%' || v_search_lower || '%'
       OR LOWER(COALESCE(c.long_name, '')) LIKE '%' || v_search_lower || '%';
  END IF;

  WITH filtered_classes AS (
    SELECT c.id, c.day_of_week, c.start_time, c.end_time, c.status, c.room, c.subject_id, c.level, c.short_name, c.long_name,
      CASE WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(COALESCE(c.short_name, '')) = v_search_lower THEN 1000
        WHEN LOWER(COALESCE(c.short_name, '')) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(COALESCE(c.short_name, '')) LIKE '%' || v_search_lower || '%' THEN 800
        WHEN LOWER(COALESCE(c.long_name, '')) = v_search_lower THEN 750
        WHEN LOWER(COALESCE(c.long_name, '')) LIKE v_search_lower || '%' THEN 700
        WHEN LOWER(COALESCE(c.long_name, '')) LIKE '%' || v_search_lower || '%' THEN 600
        ELSE 0
      END AS relevance_score
    FROM classes c
    WHERE (v_class_ids IS NULL OR (array_length(v_class_ids, 1) > 0 AND c.id = ANY(v_class_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR c.status = ANY(p_statuses))
      AND (p_subject_ids IS NULL OR array_length(p_subject_ids, 1) IS NULL OR c.subject_id = ANY(p_subject_ids))
  ),
  paginated_classes AS (
    SELECT * FROM filtered_classes
    ORDER BY relevance_score DESC,
      CASE WHEN p_order_by = 'day_of_week' AND p_ascending THEN day_of_week END ASC,
      CASE WHEN p_order_by = 'day_of_week' AND NOT p_ascending THEN day_of_week END DESC,
      CASE WHEN p_order_by = 'start_time' AND p_ascending THEN start_time END ASC,
      CASE WHEN p_order_by = 'start_time' AND NOT p_ascending THEN start_time END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      day_of_week ASC, start_time ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
    'id', pc.id,
    'day_of_week', pc.day_of_week,
    'start_time', pc.start_time::TEXT,
    'end_time', pc.end_time::TEXT,
    'status', pc.status,
    'room', pc.room,
    'subject_id', pc.subject_id,
    'level', pc.level,
    'short_name', pc.short_name,
    'long_name', pc.long_name
  )), (SELECT COUNT(*) FROM filtered_classes)
  INTO v_classes, v_total_count FROM paginated_classes pc;

  IF p_include_relationships AND v_classes IS NOT NULL THEN
    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, jsonb_build_object('id', subj.id, 'curriculum', subj.curriculum, 'year_level', subj.year_level, 'name', subj.name, 'discipline', subj.discipline, 'level', subj.level, 'color', subj.color, 'short_name', subj.short_name, 'long_name', subj.long_name))
    INTO v_class_subjects FROM class_ids ci JOIN classes c ON c.id = ci.id LEFT JOIN subjects subj ON subj.id = c.subject_id;

    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'status', s.status, 'curriculum', s.curriculum, 'year_level', s.year_level, 'school', s.school) ORDER BY s.last_name, s.first_name), '[]'::jsonb) FROM classes_students cs JOIN students s ON s.id = cs.student_id WHERE cs.class_id = ci.id AND cs.unenrolled_at IS NULL))
    INTO v_class_students FROM class_ids ci;

    WITH class_ids AS (SELECT (elem.value->>'id')::UUID AS id FROM jsonb_array_elements(v_classes) AS elem(value) WHERE elem.value->>'id' IS NOT NULL)
    SELECT jsonb_object_agg(ci.id::TEXT, (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', st.id, 'first_name', st.first_name, 'last_name', st.last_name, 'role', st.role, 'status', st.status) ORDER BY st.last_name, st.first_name), '[]'::jsonb) FROM classes_staff cs JOIN staff st ON st.id = cs.staff_id WHERE cs.class_id = ci.id AND cs.unassigned_at IS NULL))
    INTO v_class_staff FROM class_ids ci;
  END IF;

  RETURN jsonb_build_object('classes', COALESCE(v_classes, '[]'::jsonb), 'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb), 'classStudents', COALESCE(v_class_students, '{}'::jsonb), 'classStaff', COALESCE(v_class_staff, '{}'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

GRANT EXECUTE ON FUNCTION search_classes_admin TO authenticated;

COMMENT ON FUNCTION search_classes_admin IS 'Admin search function for classes. Search by class short_name and long_name (ILIKE). Returns short_name and long_name in each class object.';
