-- Count a Class toward staff progression only when its Tutor Log records at
-- least one attending Student. Homework Help remains attendance-independent.

CREATE OR REPLACE FUNCTION public.compute_staff_tier_metrics(p_staff_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_metrics JSONB := '{}'::jsonb;
  v_row RECORD;
  v_key TEXT;
  v_count NUMERIC;
  v_overrides JSONB;
  v_override_key TEXT;
  v_override_val NUMERIC;
  v_employment_started_at TIMESTAMPTZ;
  v_tenure_days INTEGER;
  v_tenure_weeks INTEGER;
  v_tenure_months INTEGER;
  v_last_promotion_at TIMESTAMPTZ;
  v_since_promotion_days INTEGER;
  v_since_promotion_weeks INTEGER;
  v_since_promotion_months INTEGER;
  v_is_service_role BOOLEAN;
BEGIN
  v_is_service_role := COALESCE(auth.jwt() ->> 'role', '') = 'service_role';

  IF NOT v_is_service_role
    AND NOT public.is_adminstaff_active()
    AND public.current_staff_id() IS DISTINCT FROM p_staff_id
  THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT employment_started_at, metric_overrides
  INTO v_employment_started_at, v_overrides
  FROM public.staff
  WHERE id = p_staff_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Staff not found';
  END IF;

  v_tenure_days := GREATEST(0, CURRENT_DATE - v_employment_started_at::date);
  v_tenure_weeks := v_tenure_days / 7;
  v_tenure_months := (
    EXTRACT(YEAR FROM age(CURRENT_DATE, v_employment_started_at::date))::int * 12
    + EXTRACT(MONTH FROM age(CURRENT_DATE, v_employment_started_at::date))::int
  );
  v_metrics := v_metrics || jsonb_build_object(
    'tenure.days', v_tenure_days,
    'tenure.weeks', v_tenure_weeks,
    'tenure.months', v_tenure_months
  );

  SELECT reviewed_at
  INTO v_last_promotion_at
  FROM public.staff_tier_promotions
  WHERE staff_id = p_staff_id AND outcome = 'approved'
  ORDER BY reviewed_at DESC
  LIMIT 1;
  v_last_promotion_at := COALESCE(v_last_promotion_at, v_employment_started_at);

  v_since_promotion_days := GREATEST(0, CURRENT_DATE - v_last_promotion_at::date);
  v_since_promotion_weeks := v_since_promotion_days / 7;
  v_since_promotion_months := (
    EXTRACT(YEAR FROM age(CURRENT_DATE, v_last_promotion_at::date))::int * 12
    + EXTRACT(MONTH FROM age(CURRENT_DATE, v_last_promotion_at::date))::int
  );
  v_metrics := v_metrics || jsonb_build_object(
    'time_since_promotion.days', v_since_promotion_days,
    'time_since_promotion.weeks', v_since_promotion_weeks,
    'time_since_promotion.months', v_since_promotion_months
  );

  FOR v_row IN
    SELECT
      CASE
        WHEN session.type = 'HOMEWORK_HELP'::public.session_type THEN 'HOMEWORK_HELP'
        WHEN session.type = 'CLASS'::public.session_type AND subject.short_name = 'HOME' THEN 'HOMEWORK_HELP'
        ELSE session.type::text
      END AS session_type,
      CASE
        WHEN session.type = 'HOMEWORK_HELP'::public.session_type THEN 'any'
        WHEN session.type = 'CLASS'::public.session_type AND subject.short_name = 'HOME' THEN 'any'
        ELSE attendance.type::text
      END AS attendance_type,
      COUNT(*)::numeric AS cnt
    FROM public.tutor_logs tutor_log
    INNER JOIN public.sessions session ON session.id = tutor_log.session_id
    INNER JOIN public.tutor_logs_staff_attendance attendance
      ON attendance.tutor_log_id = tutor_log.id
      AND attendance.staff_id = p_staff_id
      AND attendance.attended = TRUE
    LEFT JOIN public.classes class ON class.id = session.class_id
    LEFT JOIN public.subjects subject
      ON subject.id = COALESCE(session.subject_id, class.subject_id)
    WHERE session.type <> 'CLASS'::public.session_type
      OR subject.short_name = 'HOME'
      OR EXISTS (
        SELECT 1
        FROM public.tutor_logs_student_attendance student_attendance
        WHERE student_attendance.tutor_log_id = tutor_log.id
          AND student_attendance.attended = TRUE
      )
    GROUP BY 1, 2
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, v_row.attendance_type);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  FOR v_row IN
    SELECT
      CASE WHEN topic_file.is_solutions THEN 'SOLUTIONS' ELSE topic_file.type::text END AS resource_type,
      topic.subject_id,
      COUNT(*)::numeric AS cnt
    FROM public.topics_files topic_file
    INNER JOIN public.topics topic ON topic.id = topic_file.topic_id
    WHERE topic_file.created_by = p_staff_id
    GROUP BY 1, topic.subject_id
  LOOP
    v_key := public.staff_tier_resource_metric_key(v_row.resource_type, v_row.subject_id);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  IF v_overrides IS NOT NULL AND v_overrides <> '{}'::jsonb THEN
    FOR v_override_key, v_override_val IN
      SELECT entry.key, entry.value::numeric
      FROM jsonb_each_text(v_overrides) AS entry(key, value)
      WHERE entry.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    LOOP
      v_metrics := v_metrics || jsonb_build_object(
        v_override_key,
        COALESCE((v_metrics ->> v_override_key)::numeric, 0) + v_override_val
      );
    END LOOP;
  END IF;

  FOR v_row IN
    SELECT split_part(entry.key, '.', 2) AS session_type,
           SUM(entry.value::numeric) AS cnt
    FROM jsonb_each_text(v_metrics) AS entry(key, value)
    WHERE entry.key ~ '^sessions\.[^.]+\.(MAIN_TUTOR|SECONDARY_TUTOR|TRIAL_TUTOR)$'
    GROUP BY 1
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, 'any');
    v_metrics := v_metrics || jsonb_build_object(
      v_key,
      COALESCE((v_metrics ->> v_key)::numeric, 0) + v_row.cnt
    );
  END LOOP;

  SELECT COALESCE(SUM(COALESCE(
    (v_metrics ->> public.staff_tier_session_metric_key(session_type, 'any'))::numeric,
    0
  )), 0)
  INTO v_count
  FROM unnest(ARRAY['CLASS', 'DRAFTING', 'EXAM_COURSE']) AS session_type;
  v_metrics := v_metrics || jsonb_build_object(
    'sessions.teaching.all',
    v_count + COALESCE((v_metrics ->> 'sessions.teaching.all')::numeric, 0)
  );

  SELECT COALESCE(SUM(COALESCE(
    (v_metrics ->> public.staff_tier_session_metric_key(session_type, 'any'))::numeric,
    0
  )), 0)
  INTO v_count
  FROM unnest(ARRAY['ADMIN_SHIFT', 'ADMIN_MEETING']) AS session_type;
  v_metrics := v_metrics || jsonb_build_object(
    'sessions.admin.all',
    v_count + COALESCE((v_metrics ->> 'sessions.admin.all')::numeric, 0)
  );

  RETURN v_metrics;
END;
$$;

COMMENT ON FUNCTION public.compute_staff_tier_metrics(UUID) IS
  'Computes tenure, attended logged Class, attendance-independent Homework Help, other Session, and subject-aware resource metrics, then applies additive overrides.';

REVOKE ALL ON FUNCTION public.compute_staff_tier_metrics(UUID)
  FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.compute_staff_tier_metrics(UUID)
  TO authenticated, service_role;
