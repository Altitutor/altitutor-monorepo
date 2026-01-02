-- Add phone and email fields to search_students_admin RPC function
-- This ensures phone and email are returned in search results for all consumers

CREATE OR REPLACE FUNCTION search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
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
  v_search_like TEXT;
  v_student_ids UUID[];
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  v_search_lower := CASE 
    WHEN p_search IS NULL OR TRIM(p_search) = '' THEN NULL
    ELSE LOWER(TRIM(p_search))
  END;
  v_search_like := build_fuzzy_like(v_search_lower);

  IF v_search_lower IS NOT NULL THEN
    SELECT COALESCE(ARRAY_AGG(DISTINCT id), ARRAY[]::UUID[])
    INTO v_student_ids
    FROM (
      -- Search by student names (exact + fuzzy matching)
      SELECT id
      FROM students
      WHERE LOWER(CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, ''))) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(first_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(last_name, '')) LIKE '%' || v_search_lower || '%'
         OR LOWER(COALESCE(school, '')) LIKE '%' || v_search_lower || '%'
         OR (v_search_like IS NOT NULL AND (
           CONCAT_WS(' ', COALESCE(first_name, ''), COALESCE(last_name, '')) ILIKE v_search_like
           OR COALESCE(first_name, '') ILIKE v_search_like
           OR COALESCE(last_name, '') ILIKE v_search_like
         ))
      UNION
      -- Search by class names (exact + fuzzy matching)
      SELECT DISTINCT cs.student_id
      FROM classes_students cs
      JOIN classes c ON c.id = cs.class_id
      JOIN subjects subj ON subj.id = c.subject_id
      WHERE cs.unenrolled_at IS NULL
        AND (
          LOWER(format_class_short_name(
            c.day_of_week,
            c.start_time::time,
            subj.curriculum::text,
            subj.year_level,
            subj.name
          )) LIKE '%' || v_search_lower || '%'
          OR LOWER(format_class_full_name(
            c.day_of_week,
            c.start_time::time,
            c.end_time::time,
            subj.curriculum::text,
            subj.year_level,
            subj.name
          )) LIKE '%' || v_search_lower || '%'
          OR (v_search_like IS NOT NULL AND (
            format_class_short_name(
              c.day_of_week,
              c.start_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            ) ILIKE v_search_like
            OR format_class_full_name(
              c.day_of_week,
              c.start_time::time,
              c.end_time::time,
              subj.curriculum::text,
              subj.year_level,
              subj.name
            ) ILIKE v_search_like
          ))
        )
    ) search_results;
  END IF;

  WITH filtered_students AS (
    SELECT 
      s.id,
      s.first_name,
      s.last_name,
      s.status,
      s.curriculum,
      s.year_level,
      s.school,
      s.phone,
      s.email,
      s.created_at,
      s.updated_at
    FROM students s
    WHERE (v_student_ids IS NULL OR (array_length(v_student_ids, 1) > 0 AND s.id = ANY(v_student_ids)))
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR s.status = ANY(p_statuses))
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY 
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'curriculum' AND p_ascending THEN curriculum END ASC,
      CASE WHEN p_order_by = 'curriculum' AND NOT p_ascending THEN curriculum END DESC,
      CASE WHEN p_order_by = 'year_level' AND p_ascending THEN year_level END ASC,
      CASE WHEN p_order_by = 'year_level' AND NOT p_ascending THEN year_level END DESC,
      last_name ASC
    LIMIT p_limit
    OFFSET p_offset
  )
  SELECT 
    jsonb_agg(
      jsonb_build_object(
        'id', ps.id,
        'first_name', ps.first_name,
        'last_name', ps.last_name,
        'status', ps.status,
        'curriculum', ps.curriculum,
        'year_level', ps.year_level,
        'school', ps.school,
        'phone', ps.phone,
        'email', ps.email,
        'created_at', ps.created_at,
        'updated_at', ps.updated_at,
        'classes', CASE 
          WHEN p_include_relationships THEN (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', c.id,
                  'day_of_week', c.day_of_week,
                  'start_time', c.start_time::TEXT,
                  'end_time', c.end_time::TEXT,
                  'level', c.level,
                  'subject', jsonb_build_object(
                    'id', subj.id,
                    'curriculum', subj.curriculum,
                    'year_level', subj.year_level,
                    'name', subj.name,
                    'discipline', subj.discipline,
                    'level', subj.level,
                    'color', subj.color
                  )
                )
                ORDER BY c.day_of_week, c.start_time
              ),
              '[]'::jsonb
            )
            FROM classes_students cs2
            JOIN classes c ON c.id = cs2.class_id
            LEFT JOIN subjects subj ON subj.id = c.subject_id
            WHERE cs2.student_id = ps.id AND cs2.unenrolled_at IS NULL
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students ps;

  RETURN jsonb_build_object(
    'students', COALESCE(v_students, '[]'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION search_students_admin IS 'Admin search function for students with exact + fuzzy name matching and class name search. Returns phone and email fields.';
