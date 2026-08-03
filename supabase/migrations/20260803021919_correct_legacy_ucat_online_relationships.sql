-- The original UCAT freemium migration stamped every Student that existed at
-- deployment time as onboarding-complete. Those sentinel timestamps are not
-- evidence of an actual UCATWeb signup and must not establish an online
-- product relationship.
DELETE FROM public.student_online_product_relationships relationship
USING public.students student
WHERE relationship.student_id = student.id
  AND relationship.product = 'UCAT_WEB'
  AND relationship.started_at IN (
    TIMESTAMPTZ '2026-06-07 04:23:03.496827+00',
    TIMESTAMPTZ '2026-06-09 10:59:53.919551+00'
  )
  AND student.ucat_signup_completed_at = relationship.started_at
  AND student.ucat_onboarding_completed_at = relationship.started_at;

UPDATE public.students
SET
  ucat_signup_completed_at = NULL,
  ucat_onboarding_completed_at = NULL,
  ucat_signup_step = CASE
    WHEN EXISTS (
      SELECT 1
      FROM auth.users auth_user
      WHERE auth_user.id = students.user_id
        AND auth_user.raw_user_meta_data ->> 'profile_setup_complete' = 'true'
    ) THEN 3
    ELSE 1
  END
WHERE ucat_signup_completed_at IN (
    TIMESTAMPTZ '2026-06-07 04:23:03.496827+00',
    TIMESTAMPTZ '2026-06-09 10:59:53.919551+00'
  )
  AND ucat_onboarding_completed_at = ucat_signup_completed_at;

-- These two UCAT testers were incorrectly carrying an ACTIVE in-person status.
-- Their online relationship remains intact; only the unrelated in-person lifecycle is cleared.
UPDATE public.students
SET status = NULL,
    active_at = NULL,
    registered_at = NULL
WHERE LOWER(email) IN ('byjuspare@gmail.com', 'josh.lee.microsoft@gmail.com')
  AND status = 'ACTIVE'
  AND NOT EXISTS (
    SELECT 1 FROM public.classes_students enrollment
    WHERE enrollment.student_id = students.id
      AND enrollment.unenrolled_at IS NULL
  );

CREATE OR REPLACE FUNCTION public.search_online_students_admin(
  p_search TEXT DEFAULT NULL,
  p_products TEXT[] DEFAULT NULL,
  p_entitlements TEXT[] DEFAULT NULL,
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
          'tier', CASE
            WHEN relationship.product = 'UCAT_WEB'
              AND student.ucat_online_tier_override = 'force_free' THEN 'FREE'
            WHEN relationship.product = 'UCAT_WEB'
              AND student.ucat_online_tier_override = 'force_unlimited' THEN 'UNLIMITED'
            WHEN EXISTS (
              SELECT 1
              FROM public.student_subscriptions tier_subscription
              WHERE tier_subscription.student_id = student.id
                AND tier_subscription.status IN ('trialing', 'active', 'past_due')
            ) THEN 'UNLIMITED'
            ELSE 'FREE'
          END,
          'started_at', relationship.started_at,
          'closed_at', relationship.closed_at
        ) ORDER BY relationship.started_at, relationship.product
      ) AS products,
      CASE WHEN EXISTS (
        SELECT 1
        FROM public.student_subscriptions subscription
        WHERE subscription.student_id = student.id
          AND subscription.status IN ('trialing', 'active', 'past_due')
      ) OR student.ucat_online_tier_override = 'force_unlimited'
      THEN 'PAID' ELSE 'FREE' END AS entitlement,
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
        OR ('name' = ANY(p_search_fields) AND LOWER(CONCAT_WS(' ', student.first_name, student.last_name)) LIKE '%' || v_search_lower || '%')
        OR ('email' = ANY(p_search_fields) AND LOWER(COALESCE(student.email, '')) LIKE '%' || v_search_lower || '%')
        OR ('phone' = ANY(p_search_fields) AND COALESCE(student.phone, '') LIKE '%' || v_search_lower || '%')
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
  text, text[], text[], integer, integer, text, boolean, text[]
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_online_students_admin(
  text, text[], text[], integer, integer, text, boolean, text[]
) TO authenticated, service_role;
