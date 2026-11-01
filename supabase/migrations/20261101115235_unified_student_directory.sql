-- Read-only, paginated directory. Onboarding action rules remain in the canonical
-- TypeScript model; the authenticated server supplies its derived journey index.
CREATE FUNCTION public.search_student_directory_admin(p_request jsonb DEFAULT '{}'::jsonb, p_journeys jsonb DEFAULT '[]'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Active AdminStaff access required' USING ERRCODE = '42501';
  END IF;
  WITH journey_index AS (
    SELECT * FROM jsonb_to_recordset(p_journeys) AS j(
      id uuid, student_id uuid, stage text, open boolean,
      ours boolean, waiting boolean, overdue boolean, subject_ids jsonb
    )
  ), base AS (
    SELECT s.id, 'student'::text AS kind, to_jsonb(s) AS student,
      concat_ws(' ', s.first_name, s.last_name) AS label,
      s.first_name, s.last_name, s.email, s.phone, s.created_at,
      s.status, s.curriculum, s.year_level, s.account_class,
      j.id AS journey_id, j.stage, j.open, j.ours, j.waiting, j.overdue,
      products.products, products.online_since,
      CASE WHEN s.ucat_online_tier_override = 'force_unlimited' OR EXISTS (
        SELECT 1 FROM public.student_subscriptions sub WHERE sub.student_id = s.id AND sub.status IN ('active','trialing','past_due')
      ) THEN 'PAID' ELSE 'FREE' END AS entitlement,
      EXISTS (SELECT 1 FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id
        WHERE cs.student_id = s.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL) AS has_class,
      j.subject_ids
    FROM public.students s
    LEFT JOIN LATERAL (SELECT ji.* FROM journey_index ji WHERE ji.student_id = s.id
      ORDER BY ji.open DESC, (SELECT oj.created_at FROM public.onboarding_journeys oj WHERE oj.id = ji.id) DESC, ji.id LIMIT 1) j ON true
    LEFT JOIN LATERAL (
      SELECT min(r.started_at) AS online_since, coalesce(jsonb_agg(jsonb_build_object(
        'product', r.product, 'started_at', r.started_at, 'closed_at', r.closed_at,
        'tier', CASE WHEN r.product = 'UCAT_WEB' AND s.ucat_online_tier_override = 'force_free' THEN 'FREE'
          WHEN (r.product = 'UCAT_WEB' AND s.ucat_online_tier_override = 'force_unlimited') OR EXISTS (
            SELECT 1 FROM public.student_subscriptions sub WHERE sub.student_id = s.id AND sub.status IN ('active','trialing','past_due')
          ) THEN 'UNLIMITED' ELSE 'FREE' END
      ) ORDER BY r.started_at, r.product), '[]'::jsonb) AS products
      FROM public.student_online_product_relationships r WHERE r.student_id = s.id AND r.closed_at IS NULL
    ) products ON true
    WHERE s.deleted_at IS NULL
    UNION ALL
    SELECT oj.id, 'enquiry', NULL::jsonb, oj.label, oj.label, NULL, NULL, NULL, oj.created_at,
      NULL, NULL, NULL, NULL, j.id, j.stage, j.open, j.ours, j.waiting, j.overdue,
      '[]'::jsonb, NULL, NULL, false, j.subject_ids
    FROM public.onboarding_journeys oj JOIN journey_index j ON j.id = oj.id
    WHERE oj.student_id IS NULL
  ), filtered AS (
    SELECT b.* FROM base b WHERE
      (coalesce(p_request->>'search','') = '' OR (
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'name' AND b.label ILIKE '%' || (p_request->>'search') || '%') OR
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'email' AND b.email ILIKE '%' || (p_request->>'search') || '%') OR
        (coalesce(p_request->'searchFields','["name","email","phone"]'::jsonb) ? 'phone' AND b.phone ILIKE '%' || (p_request->>'search') || '%')
      ))
      AND (coalesce(p_request->'filters'->'relationship', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'relationship') f(value) WHERE ((f.value = 'in_person' AND b.status IS NOT NULL) OR (f.value = 'online' AND b.online_since IS NOT NULL) OR (f.value = 'trial' AND coalesce(b.status,'') <> 'DISCONTINUED' AND (b.status = 'TRIAL' OR b.open)))))
      AND (coalesce(p_request->'filters'->'status', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'status') f(value) WHERE f.value = b.status))
      AND (coalesce(p_request->'filters'->'curriculum', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'curriculum') f(value) WHERE f.value = b.curriculum))
      AND (coalesce(p_request->'filters'->'yearLevel', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'yearLevel') f(value) WHERE f.value = b.year_level::text))
      AND (coalesce(p_request->'filters'->'accountClass', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'accountClass') f(value) WHERE f.value = b.account_class))
      AND (coalesce(p_request->'filters'->'entitlement', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'entitlement') f(value) WHERE f.value = b.entitlement))
      AND (coalesce(p_request->'filters'->'onboardingStatus', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'onboardingStatus') f(value) WHERE f.value = coalesce(b.stage, 'No onboarding')))
      AND (coalesce(p_request->'filters'->'product', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'product') f(value) WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(b.products) product WHERE product->>'product' = f.value)))
      AND (coalesce(p_request->'filters'->'inPersonClass', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'inPersonClass') f(value) WHERE ((f.value = 'has' AND b.has_class) OR (f.value = 'none' AND NOT b.has_class))))
      AND (coalesce(p_request->'filters'->'queue', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'queue') f(value) WHERE ((f.value = 'closed' AND NOT b.open) OR (b.open AND (f.value = 'open' OR (f.value = 'ours' AND b.ours) OR (f.value = 'waiting' AND b.waiting) OR (f.value = 'overdue' AND b.overdue))))))
      AND (coalesce(p_request->'filters'->'subject', '[]'::jsonb) = '[]'::jsonb OR EXISTS (SELECT 1 FROM jsonb_array_elements_text(p_request->'filters'->'subject') f(value) WHERE (coalesce(b.subject_ids,'[]'::jsonb) ? f.value OR EXISTS (SELECT 1 FROM public.students_subjects ss WHERE ss.student_id = b.id AND ss.subject_id::text = f.value) OR EXISTS (SELECT 1 FROM public.students_online_access_manual sa WHERE sa.student_id = b.id AND sa.subject_id::text = f.value) OR EXISTS (SELECT 1 FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id WHERE cs.student_id = b.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL AND c.subject_id::text = f.value))))
  ), ordered AS (
    SELECT *, row_number() OVER (ORDER BY
      CASE p_request->>'groupBy' WHEN 'stage' THEN coalesce(stage,'No onboarding') WHEN 'status' THEN coalesce(status,'No in-person status') WHEN 'curriculum' THEN coalesce(curriculum,'No curriculum') WHEN 'year_level' THEN coalesce(year_level::text,'No year level') WHEN 'account_class' THEN coalesce(account_class,'Enquiries') END ASC,
      CASE WHEN p_request->>'sortBy' = 'status' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN CASE status WHEN 'ACTIVE' THEN '3' WHEN 'TRIAL' THEN '2' WHEN 'DISCONTINUED' THEN '1' ELSE '0' END END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'status' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN CASE status WHEN 'ACTIVE' THEN '3' WHEN 'TRIAL' THEN '2' WHEN 'DISCONTINUED' THEN '1' ELSE '0' END END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'first_name' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN first_name END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'first_name' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN first_name END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'last_name' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN last_name END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'last_name' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN last_name END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'created_at' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN created_at::text END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'created_at' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN created_at::text END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'online_since' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN online_since::text END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'online_since' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN online_since::text END desc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'stage' AND coalesce(p_request->>'sortDirection','asc') = 'asc' THEN stage END asc NULLS LAST,
      CASE WHEN p_request->>'sortBy' = 'stage' AND coalesce(p_request->>'sortDirection','asc') = 'desc' THEN stage END desc NULLS LAST,
      last_name ASC NULLS LAST, first_name ASC NULLS LAST, id
    ) AS ordinal FROM filtered
  ), page AS (
    SELECT * FROM ordered ORDER BY ordinal
    LIMIT least(greatest(coalesce((p_request->>'pageSize')::integer, 50),1),200)
    OFFSET greatest(coalesce((p_request->>'page')::integer,1)-1,0) * least(greatest(coalesce((p_request->>'pageSize')::integer,50),1),200)
  ), entries AS (
    SELECT ordinal, jsonb_build_object('kind', kind, 'id', id, 'label', label,
      'journey_id', journey_id, 'stage', stage, 'products', products, 'online_since', online_since,
      'student', CASE WHEN kind = 'student' THEN student || jsonb_build_object(
        'classes', (SELECT coalesce(jsonb_agg(to_jsonb(c) || jsonb_build_object('subject', to_jsonb(subject)) ORDER BY c.day_of_week, c.start_time), '[]'::jsonb)
          FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id LEFT JOIN public.subjects subject ON subject.id = c.subject_id
          WHERE cs.student_id = page.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL),
        'subjects', (SELECT coalesce(jsonb_agg(to_jsonb(subject)), '[]'::jsonb) FROM public.subjects subject WHERE subject.deleted_at IS NULL AND subject.id IN (
          SELECT ss.subject_id FROM public.students_subjects ss WHERE ss.student_id = page.id
          UNION SELECT sa.subject_id FROM public.students_online_access_manual sa WHERE sa.student_id = page.id
          UNION SELECT c.subject_id FROM public.classes_students cs JOIN public.classes c ON c.id = cs.class_id WHERE cs.student_id = page.id AND cs.unenrolled_at IS NULL AND c.deleted_at IS NULL
        )),
        'parents', (SELECT coalesce(jsonb_agg(to_jsonb(parent)), '[]'::jsonb) FROM public.parents_students ps JOIN public.parents parent ON parent.id = ps.parent_id WHERE ps.student_id = page.id AND parent.deleted_at IS NULL)
      ) ELSE NULL END
    ) AS entry FROM page
  )
  SELECT jsonb_build_object('entries', coalesce((SELECT jsonb_agg(entry ORDER BY ordinal) FROM entries), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered)) INTO result;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.search_student_directory_admin(jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_student_directory_admin(jsonb,jsonb) TO authenticated, service_role;
