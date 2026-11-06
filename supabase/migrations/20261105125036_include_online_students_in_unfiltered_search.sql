-- Explicitly unfiltered admin searches include online-only Students. The default
-- ACTIVE/TRIAL status filter, active AdminStaff check and deletion filter remain.
CREATE OR REPLACE FUNCTION public.search_students_admin(p_search text DEFAULT NULL::text, p_statuses text[] DEFAULT ARRAY['ACTIVE'::text, 'TRIAL'::text], p_subject_ids uuid[] DEFAULT NULL::uuid[], p_include_relationships boolean DEFAULT true, p_exclude_class_search boolean DEFAULT false, p_limit integer DEFAULT 20, p_offset integer DEFAULT 0, p_order_by text DEFAULT 'last_name'::text, p_ascending boolean DEFAULT true, p_subscription_filter text DEFAULT NULL::text, p_in_person_filter text DEFAULT NULL::text, p_search_fields text[] DEFAULT ARRAY['name'::text, 'email'::text, 'phone'::text])
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  WITH filtered_students AS (
    SELECT
      student.*,
      EXISTS (
        SELECT 1 FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
      ) AS has_online_subscription,
      EXISTS (
        SELECT 1 FROM public.classes_students enrollment
        WHERE enrollment.student_id = student.id
          AND enrollment.unenrolled_at IS NULL
      ) AS has_in_person_class,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE v_search_lower || '%' THEN 900
        ELSE 800
      END AS relevance_score
    FROM public.students student
    WHERE student.deleted_at IS NULL
      AND (
        v_search_lower IS NULL
        OR ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%')
        OR (
          NOT p_exclude_class_search
          AND EXISTS (
            SELECT 1
            FROM public.classes_students enrollment
            JOIN public.classes class ON class.id = enrollment.class_id
            WHERE enrollment.student_id = student.id
              AND (
                LOWER(COALESCE(class.short_name, '')) LIKE '%' || v_search_lower || '%'
                OR LOWER(COALESCE(class.long_name, '')) LIKE '%' || v_search_lower || '%'
              )
          )
        )
      )
      AND (
        p_statuses IS NULL
        OR array_length(p_statuses, 1) IS NULL
        OR student.status = ANY(p_statuses)
      )
      AND (
        p_subject_ids IS NULL
        OR array_length(p_subject_ids, 1) IS NULL
        OR EXISTS (
          SELECT 1 FROM public.students_subjects student_subject
          WHERE student_subject.student_id = student.id
            AND student_subject.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1 FROM public.students_online_access_manual manual_access
          WHERE manual_access.student_id = student.id
            AND manual_access.subject_id = ANY(p_subject_ids)
        )
        OR EXISTS (
          SELECT 1
          FROM public.classes_students enrollment
          JOIN public.classes class ON class.id = enrollment.class_id
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
            AND class.subject_id = ANY(p_subject_ids)
        )
      )
      AND (
        p_subscription_filter IS NULL
        OR p_subscription_filter NOT IN ('has', 'none')
        OR (p_subscription_filter = 'has' AND EXISTS (
          SELECT 1 FROM public.student_subscriptions subscription
          WHERE subscription.student_id = student.id
        ))
        OR (p_subscription_filter = 'none' AND NOT EXISTS (
          SELECT 1 FROM public.student_subscriptions subscription
          WHERE subscription.student_id = student.id
        ))
      )
      AND (
        p_in_person_filter IS NULL
        OR p_in_person_filter NOT IN ('has', 'none')
        OR (p_in_person_filter = 'has' AND EXISTS (
          SELECT 1 FROM public.classes_students enrollment
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
        ))
        OR (p_in_person_filter = 'none' AND NOT EXISTS (
          SELECT 1 FROM public.classes_students enrollment
          WHERE enrollment.student_id = student.id
            AND enrollment.unenrolled_at IS NULL
        ))
      )
  ),
  paginated_students AS (
    SELECT *
    FROM filtered_students
    ORDER BY
      relevance_score DESC,
      CASE WHEN p_order_by = 'first_name' AND p_ascending THEN first_name END ASC,
      CASE WHEN p_order_by = 'first_name' AND NOT p_ascending THEN first_name END DESC,
      CASE WHEN p_order_by = 'last_name' AND p_ascending THEN last_name END ASC,
      CASE WHEN p_order_by = 'last_name' AND NOT p_ascending THEN last_name END DESC,
      CASE WHEN p_order_by = 'status' AND p_ascending THEN status END ASC,
      CASE WHEN p_order_by = 'status' AND NOT p_ascending THEN status END DESC,
      CASE WHEN p_order_by = 'created_at' AND p_ascending THEN created_at END ASC,
      CASE WHEN p_order_by = 'created_at' AND NOT p_ascending THEN created_at END DESC,
      last_name ASC,
      first_name ASC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    COALESCE(jsonb_agg(
      to_jsonb(page_student) - 'relevance_score' || jsonb_build_object(
        'classes', CASE WHEN p_include_relationships THEN (
          SELECT COALESCE(jsonb_agg(jsonb_build_object(
            'id', class.id,
            'short_name', class.short_name,
            'long_name', class.long_name,
            'day_of_week', class.day_of_week,
            'start_time', class.start_time::TEXT,
            'end_time', class.end_time::TEXT,
            'level', class.level,
            'subject', CASE WHEN subject.id IS NULL THEN NULL ELSE jsonb_build_object(
              'id', subject.id,
              'curriculum', subject.curriculum,
              'year_level', subject.year_level,
              'name', subject.name,
              'discipline', subject.discipline,
              'level', subject.level,
              'color', subject.color,
              'short_name', subject.short_name,
              'long_name', subject.long_name
            ) END
          ) ORDER BY class.day_of_week, class.start_time), '[]'::jsonb)
          FROM public.classes_students enrollment
          JOIN public.classes class ON class.id = enrollment.class_id
          LEFT JOIN public.subjects subject ON subject.id = class.subject_id
          WHERE enrollment.student_id = page_student.id
            AND enrollment.unenrolled_at IS NULL
        ) ELSE '[]'::jsonb END
      )
    ), '[]'::jsonb),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students page_student;

  RETURN jsonb_build_object('students', v_students, 'total', COALESCE(v_total_count, 0));
END;
$function$;
