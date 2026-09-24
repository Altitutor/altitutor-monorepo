-- Allow admin parent/staff list search to target name, email, and phone,
-- matching search_students_admin. Drop the previous signatures first so
-- PostgREST does not see an unresolved overload.

DROP FUNCTION IF EXISTS public.search_parents_admin(
  text, boolean, integer, integer, text, boolean
);

DROP FUNCTION IF EXISTS public.search_staff_admin(
  text, text[], uuid[], boolean, boolean, integer, integer, text, boolean
);

CREATE OR REPLACE FUNCTION public.search_parents_admin(
  p_search TEXT DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE,
  p_search_fields TEXT[] DEFAULT ARRAY['name', 'email', 'phone']::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_parents JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('parents', '[]'::jsonb, 'total', 0);
  END IF;

  WITH filtered_parents AS (
    SELECT
      parent.id,
      parent.first_name,
      parent.last_name,
      parent.email,
      parent.phone,
      parent.created_at,
      parent.updated_at
    FROM public.parents parent
    WHERE (
      v_search_lower IS NULL
      OR (
        ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', COALESCE(parent.first_name, ''), COALESCE(parent.last_name, ''))) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(parent.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(parent.phone, '') LIKE '%' || v_search_lower || '%')
      )
    )
  ),
  paginated_parents AS (
    SELECT *
    FROM filtered_parents
    ORDER BY
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'email' AND p_ascending THEN email END ASC,
      CASE WHEN p_order_by = 'email' AND NOT p_ascending THEN email END DESC,
      last_name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT
    jsonb_agg(
      jsonb_build_object(
        'id', page_parent.id,
        'first_name', page_parent.first_name,
        'last_name', page_parent.last_name,
        'email', page_parent.email,
        'phone', page_parent.phone,
        'created_at', page_parent.created_at,
        'updated_at', page_parent.updated_at,
        'students', CASE
          WHEN p_include_relationships THEN (
            SELECT COALESCE(
              jsonb_agg(
                jsonb_build_object(
                  'id', student.id,
                  'first_name', student.first_name,
                  'last_name', student.last_name,
                  'status', student.status,
                  'curriculum', student.curriculum,
                  'year_level', student.year_level,
                  'school', student.school
                )
                ORDER BY student.last_name, student.first_name
              ),
              '[]'::jsonb
            )
            FROM public.parents_students link
            JOIN public.students student ON student.id = link.student_id
            WHERE link.parent_id = page_parent.id
          )
          ELSE '[]'::jsonb
        END
      )
    ),
    (SELECT COUNT(*) FROM filtered_parents)
  INTO v_parents, v_total_count
  FROM paginated_parents page_parent;

  RETURN jsonb_build_object('parents', COALESCE(v_parents, '[]'::jsonb), 'total', COALESCE(v_total_count, 0));
END;
$$;

CREATE OR REPLACE FUNCTION public.search_staff_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_class_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE,
  p_search_fields TEXT[] DEFAULT ARRAY['name', 'email', 'phone']::TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_staff JSONB;
  v_total_count BIGINT;
  v_staff_classes JSONB;
  v_class_subjects JSONB;
  v_class_ids UUID[];
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('staff', '[]'::jsonb, 'staffClasses', '{}'::jsonb, 'classSubjects', '{}'::jsonb, 'total', 0);
  END IF;

  WITH filtered_staff AS (
    SELECT
      staff_member.id,
      staff_member.first_name,
      staff_member.last_name,
      staff_member.role,
      staff_member.status,
      staff_member.email,
      staff_member.phone_number,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', COALESCE(staff_member.first_name, ''), COALESCE(staff_member.last_name, ''))) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', COALESCE(staff_member.first_name, ''), COALESCE(staff_member.last_name, ''))) LIKE v_search_lower || '%' THEN 900
        WHEN LOWER(CONCAT_WS(' ', COALESCE(staff_member.first_name, ''), COALESCE(staff_member.last_name, ''))) LIKE '%' || v_search_lower || '%' THEN 800
        WHEN LOWER(COALESCE(staff_member.email, '')) LIKE '%' || v_search_lower || '%' THEN 700
        WHEN COALESCE(staff_member.phone_number, '') LIKE '%' || v_search_lower || '%' THEN 600
        ELSE 0
      END AS relevance_score
    FROM public.staff staff_member
    WHERE (
      v_search_lower IS NULL
      OR (
        ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', COALESCE(staff_member.first_name, ''), COALESCE(staff_member.last_name, ''))) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(staff_member.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(staff_member.phone_number, '') LIKE '%' || v_search_lower || '%')
      )
    )
      AND (p_statuses IS NULL OR array_length(p_statuses, 1) IS NULL OR staff_member.status = ANY(p_statuses))
      AND (
        p_subject_ids IS NULL
        OR array_length(p_subject_ids, 1) IS NULL
        OR EXISTS (SELECT 1 FROM public.staff_subjects subject_link WHERE subject_link.staff_id = staff_member.id AND subject_link.subject_id = ANY(p_subject_ids))
        OR EXISTS (
          SELECT 1
          FROM public.classes_staff class_link
          JOIN public.classes class ON class.id = class_link.class_id
          WHERE class_link.staff_id = staff_member.id
            AND class_link.unassigned_at IS NULL
            AND class.subject_id = ANY(p_subject_ids)
        )
      )
  ),
  paginated_staff AS (
    SELECT *
    FROM filtered_staff
    ORDER BY relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'role' AND p_ascending THEN role END ASC,
      CASE WHEN p_order_by = 'role' AND NOT p_ascending THEN role END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      last_name ASC
    LIMIT p_limit OFFSET p_offset
  )
  SELECT jsonb_agg(jsonb_build_object(
      'id', page_staff.id,
      'first_name', page_staff.first_name,
      'last_name', page_staff.last_name,
      'role', page_staff.role,
      'status', page_staff.status,
      'email', page_staff.email,
      'phone_number', page_staff.phone_number
    )), (SELECT COUNT(*) FROM filtered_staff)
  INTO v_staff, v_total_count
  FROM paginated_staff page_staff;

  IF p_include_relationships AND v_staff IS NOT NULL THEN
    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_staff) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT ARRAY_AGG(DISTINCT class_link.class_id)
    INTO v_class_ids
    FROM public.classes_staff class_link
    JOIN staff_ids selected ON selected.id = class_link.staff_id
    WHERE class_link.unassigned_at IS NULL;

    WITH staff_ids AS (
      SELECT (elem.value->>'id')::UUID AS id
      FROM jsonb_array_elements(v_staff) AS elem(value)
      WHERE elem.value->>'id' IS NOT NULL
    )
    SELECT jsonb_object_agg(selected.id::TEXT, (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'id', class.id,
        'short_name', class.short_name,
        'long_name', class.long_name,
        'day_of_week', class.day_of_week,
        'start_time', class.start_time::TEXT,
        'end_time', class.end_time::TEXT,
        'status', class.status,
        'room', class.room,
        'level', class.level,
        'subject_id', class.subject_id,
        'subject', jsonb_build_object(
          'id', subject.id,
          'curriculum', subject.curriculum,
          'year_level', subject.year_level,
          'name', subject.name,
          'discipline', subject.discipline,
          'level', subject.level,
          'color', subject.color,
          'short_name', subject.short_name,
          'long_name', subject.long_name
        )
      ) ORDER BY class.day_of_week, class.start_time), '[]'::jsonb)
      FROM public.classes_staff class_link
      JOIN public.classes class ON class.id = class_link.class_id
      LEFT JOIN public.subjects subject ON subject.id = class.subject_id
      WHERE class_link.staff_id = selected.id
        AND class_link.unassigned_at IS NULL
    ))
    INTO v_staff_classes
    FROM staff_ids selected;

    IF v_class_ids IS NOT NULL THEN
      SELECT jsonb_object_agg(
        class.id::TEXT,
        jsonb_build_object(
          'id', subject.id,
          'curriculum', subject.curriculum,
          'year_level', subject.year_level,
          'name', subject.name,
          'discipline', subject.discipline,
          'level', subject.level,
          'color', subject.color,
          'short_name', subject.short_name,
          'long_name', subject.long_name
        )
      )
      INTO v_class_subjects
      FROM unnest(v_class_ids) AS class_id
      JOIN public.classes class ON class.id = class_id
      LEFT JOIN public.subjects subject ON subject.id = class.subject_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'staff', COALESCE(v_staff, '[]'::jsonb),
    'staffClasses', COALESCE(v_staff_classes, '{}'::jsonb),
    'classSubjects', COALESCE(v_class_subjects, '{}'::jsonb),
    'total', COALESCE(v_total_count, 0)
  );
END;
$$;

COMMENT ON FUNCTION public.search_parents_admin(
  text, boolean, integer, integer, text, boolean, text[]
) IS 'Admin search function for parents. Matches name, email, and/or phone according to p_search_fields.';

COMMENT ON FUNCTION public.search_staff_admin(
  text, text[], uuid[], boolean, boolean, integer, integer, text, boolean, text[]
) IS 'Admin search function for staff. Matches name, email, and/or phone according to p_search_fields. Returns staffClasses with short_name and long_name for display.';

REVOKE ALL ON FUNCTION public.search_parents_admin(
  text, boolean, integer, integer, text, boolean, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_parents_admin(
  text, boolean, integer, integer, text, boolean, text[]
) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.search_staff_admin(
  text, text[], uuid[], boolean, boolean, integer, integer, text, boolean, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_staff_admin(
  text, text[], uuid[], boolean, boolean, integer, integer, text, boolean, text[]
) TO authenticated, service_role;
