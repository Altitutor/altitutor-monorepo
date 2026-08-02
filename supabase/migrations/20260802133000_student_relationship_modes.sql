-- Model in-person status independently from online product relationships.
-- `students.status` is retained as the single in-person lifecycle column because
-- it is deeply integrated with in-person operational functions. NULL means the
-- Student has no in-person relationship.

UPDATE public.students
SET status = 'DISCONTINUED'
WHERE status = 'INACTIVE';

ALTER TABLE public.students
  ALTER COLUMN status DROP NOT NULL,
  DROP CONSTRAINT IF EXISTS students_status_check;

ALTER TABLE public.students
  ADD CONSTRAINT students_status_check
  CHECK (status IS NULL OR status IN ('TRIAL', 'ACTIVE', 'DISCONTINUED'));

COMMENT ON COLUMN public.students.status IS
  'In-person relationship lifecycle only: TRIAL, ACTIVE, or DISCONTINUED. NULL means no in-person relationship; this is not a global Student status.';

CREATE OR REPLACE FUNCTION public.prevent_dual_active_roles()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_other_active BOOLEAN;
BEGIN
  IF TG_TABLE_NAME = 'students' THEN
    -- A Student account is a role regardless of whether its in-person
    -- relationship is NULL, TRIAL, ACTIVE, or DISCONTINUED.
    IF NEW.user_id IS NOT NULL THEN
      SELECT EXISTS (
        SELECT 1
        FROM public.staff
        WHERE user_id = NEW.user_id
          AND status IN ('ACTIVE', 'TRIAL')
      ) INTO v_other_active;

      IF v_other_active THEN
        RAISE EXCEPTION 'User has an active staff record';
      END IF;
    END IF;
  ELSIF NEW.user_id IS NOT NULL AND NEW.status IN ('ACTIVE', 'TRIAL') THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.students
      WHERE user_id = NEW.user_id
    ) INTO v_other_active;

    IF v_other_active THEN
      RAISE EXCEPTION 'User has an active student record';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TABLE public.student_online_product_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  product TEXT NOT NULL CHECK (product IN ('UCAT_WEB', 'STUDENT_WEB')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT student_online_product_relationships_student_product_key
    UNIQUE (student_id, product),
  CONSTRAINT student_online_product_relationships_dates_check
    CHECK (closed_at IS NULL OR closed_at >= started_at)
);

CREATE INDEX student_online_product_relationships_product_open_idx
  ON public.student_online_product_relationships (product, student_id)
  WHERE closed_at IS NULL;

CREATE INDEX student_online_product_relationships_student_idx
  ON public.student_online_product_relationships (student_id, product);

COMMENT ON TABLE public.student_online_product_relationships IS
  'Explicit Product app relationships established by completed online signup. Independent from subscriptions, entitlements, and in-person status.';

CREATE TRIGGER update_student_online_product_relationships_updated_at
  BEFORE UPDATE ON public.student_online_product_relationships
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.student_online_product_relationships ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to online product relationships"
  ON public.student_online_product_relationships
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "Students read own online product relationships"
  ON public.student_online_product_relationships
  FOR SELECT TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

REVOKE ALL ON public.student_online_product_relationships FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_online_product_relationships TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.student_online_product_relationships TO service_role;

-- Existing completed UCAT signups establish the initial explicit relationships.
INSERT INTO public.student_online_product_relationships (
  student_id,
  product,
  started_at
)
SELECT
  student.id,
  'UCAT_WEB',
  COALESCE(student.ucat_signup_completed_at, student.ucat_onboarding_completed_at)
FROM public.students student
WHERE COALESCE(
  student.ucat_signup_completed_at,
  student.ucat_onboarding_completed_at
) IS NOT NULL
ON CONFLICT (student_id, product) DO NOTHING;

-- UCATWeb formerly created every new profile as ACTIVE. Clear that accidental
-- in-person state only where there is no evidence of an in-person relationship.
UPDATE public.students student
SET
  status = NULL,
  active_at = NULL,
  registered_at = NULL
WHERE student.status = 'ACTIVE'
  AND EXISTS (
    SELECT 1
    FROM public.student_online_product_relationships relationship
    WHERE relationship.student_id = student.id
      AND relationship.product = 'UCAT_WEB'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.classes_students enrollment
    WHERE enrollment.student_id = student.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sessions_students session_student
    WHERE session_student.student_id = student.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.parents_students parent_student
    WHERE parent_student.student_id = student.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.students_subjects student_subject
    WHERE student_subject.student_id = student.id
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.student_exit_requests exit_request
    WHERE exit_request.student_id = student.id
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.activity_events event
    WHERE event.entity_type = 'students'
      AND event.entity_id = student.id
      AND event.changed_fields -> 'status' ->> 'old' = 'TRIAL'
      AND event.changed_fields -> 'status' ->> 'new' = 'ACTIVE'
  );

CREATE OR REPLACE FUNCTION public.is_ucat_online_student()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.student_online_product_relationships relationship
    WHERE relationship.student_id = (SELECT public.current_student_id())
      AND relationship.product = 'UCAT_WEB'
      AND relationship.closed_at IS NULL
  );
$$;

COMMENT ON FUNCTION public.is_ucat_online_student() IS
  'True when the current Student has an explicit open UCATWeb product relationship established by completed signup.';

CREATE OR REPLACE FUNCTION public.search_students_admin(
  p_search TEXT DEFAULT NULL,
  p_statuses TEXT[] DEFAULT ARRAY['ACTIVE', 'TRIAL']::TEXT[],
  p_subject_ids UUID[] DEFAULT NULL,
  p_include_relationships BOOLEAN DEFAULT TRUE,
  p_exclude_class_search BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0,
  p_order_by TEXT DEFAULT 'last_name',
  p_ascending BOOLEAN DEFAULT TRUE,
  p_subscription_filter TEXT DEFAULT NULL,
  p_in_person_filter TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
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
    WHERE student.status IS NOT NULL
      AND (
        v_search_lower IS NULL
        OR LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%'
        OR COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%'
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
$$;

COMMENT ON FUNCTION public.search_students_admin(
  text, text[], uuid[], boolean, boolean, integer, integer, text, boolean, text, text
) IS 'Admin in-person Students search. Excludes Students whose in-person status is NULL.';

CREATE OR REPLACE FUNCTION public.search_online_students_admin(
  p_search TEXT DEFAULT NULL,
  p_products TEXT[] DEFAULT NULL,
  p_entitlements TEXT[] DEFAULT NULL,
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
  v_search_lower TEXT := NULLIF(LOWER(TRIM(COALESCE(p_search, ''))), '');
  v_students JSONB;
  v_total_count BIGINT;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RETURN jsonb_build_object('students', '[]'::jsonb, 'total', 0);
  END IF;

  WITH online_students AS (
    SELECT
      student.id,
      student.first_name,
      student.last_name,
      student.email,
      student.phone,
      student.school,
      student.curriculum,
      student.year_level,
      student.status AS in_person_status,
      student.created_at,
      student.updated_at,
      MIN(relationship.started_at) AS online_since,
      jsonb_agg(
        jsonb_build_object(
          'product', relationship.product,
          'started_at', relationship.started_at,
          'closed_at', relationship.closed_at
        ) ORDER BY relationship.started_at, relationship.product
      ) AS products,
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
          AND subscription.status IN ('trialing', 'active', 'past_due')
      ) THEN 'PAID' ELSE 'FREE' END AS entitlement,
      (
        SELECT subscription.status
        FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
        ORDER BY subscription.updated_at DESC NULLS LAST, subscription.created_at DESC
        LIMIT 1
      ) AS subscription_status
    FROM public.students student
    JOIN public.student_online_product_relationships relationship
      ON relationship.student_id = student.id
      AND relationship.closed_at IS NULL
    WHERE (
        v_search_lower IS NULL
        OR LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%'
        OR LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%'
        OR COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%'
      )
      AND (
        p_products IS NULL
        OR array_length(p_products, 1) IS NULL
        OR EXISTS (
          SELECT 1
          FROM public.student_online_product_relationships product_filter
          WHERE product_filter.student_id = student.id
            AND product_filter.closed_at IS NULL
            AND product_filter.product = ANY(p_products)
        )
      )
    GROUP BY student.id
  ),
  filtered_students AS (
    SELECT *,
      CASE
        WHEN v_search_lower IS NULL THEN 0
        WHEN LOWER(CONCAT_WS(' ', first_name, last_name)) = v_search_lower THEN 1000
        WHEN LOWER(CONCAT_WS(' ', first_name, last_name)) LIKE v_search_lower || '%' THEN 900
        ELSE 800
      END AS relevance_score
    FROM online_students
    WHERE p_entitlements IS NULL
      OR array_length(p_entitlements, 1) IS NULL
      OR entitlement = ANY(p_entitlements)
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
      CASE WHEN p_order_by = 'online_since' AND p_ascending THEN online_since END ASC,
      CASE WHEN p_order_by = 'online_since' AND NOT p_ascending THEN online_since END DESC,
      last_name ASC,
      first_name ASC
    LIMIT GREATEST(p_limit, 0)
    OFFSET GREATEST(p_offset, 0)
  )
  SELECT
    COALESCE(jsonb_agg(to_jsonb(page_student) - 'relevance_score'), '[]'::jsonb),
    (SELECT COUNT(*) FROM filtered_students)
  INTO v_students, v_total_count
  FROM paginated_students page_student;

  RETURN jsonb_build_object('students', v_students, 'total', COALESCE(v_total_count, 0));
END;
$$;

REVOKE ALL ON FUNCTION public.search_online_students_admin(
  text, text[], text[], integer, integer, text, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_online_students_admin(
  text, text[], text[], integer, integer, text, boolean
) TO authenticated, service_role;

COMMENT ON FUNCTION public.search_online_students_admin(
  text, text[], text[], integer, integer, text, boolean
) IS 'Admin Online Students search. Returns one row per Student with all matching open Product app relationships.';
