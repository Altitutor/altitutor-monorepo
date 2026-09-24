-- Add standalone Homework Help sessions and subject-aware resource counts to pay tiers,
-- then backfill active staff from the 2020-2025 legacy tutor-log workbooks.
--
-- The backfill excludes the copied partial 2024 cycle in the 2023 workbook, removes
-- copied overlap rows between adjacent pay-cycle sheets, and stops at 2025-12-31 so
-- that database tutor logs and resources remain the source of truth from 2026 onward.

ALTER TYPE public.staff_pay_tier_requirement_kind ADD VALUE IF NOT EXISTS 'RESOURCE_COUNT';

CREATE OR REPLACE FUNCTION public.staff_tier_resource_metric_key(
  p_resource_type TEXT,
  p_subject_id UUID DEFAULT NULL
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT format(
    'resources.created.subject.%s.type.%s',
    COALESCE(p_subject_id::text, 'UNKNOWN'),
    UPPER(BTRIM(p_resource_type))
  );
$$;

REVOKE ALL ON FUNCTION public.staff_tier_resource_metric_key(TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_tier_resource_metric_key(TEXT, UUID)
  TO service_role;

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
  WHERE staff_id = p_staff_id
    AND outcome = 'approved'
  ORDER BY reviewed_at DESC
  LIMIT 1;

  IF v_last_promotion_at IS NULL THEN
    v_last_promotion_at := v_employment_started_at;
  END IF;

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

  -- Homework Help is a pay-tier-only session category. It is deliberately removed
  -- from CLASS metrics and is roleless for requirement purposes.
  FOR v_row IN
    SELECT
      CASE
        WHEN session.type = 'CLASS' AND subject.short_name = 'HOME' THEN 'HOMEWORK_HELP'
        ELSE session.type::text
      END AS session_type,
      CASE
        WHEN session.type = 'CLASS' AND subject.short_name = 'HOME' THEN 'any'
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
    GROUP BY 1, 2
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, v_row.attendance_type);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  -- A solution is an exclusive pay-tier category even though the resources model
  -- stores it as a boolean alongside the underlying resource type.
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

  -- Apply canonical leaf overrides before deriving session aggregates. This makes
  -- historical class/admin overrides contribute to roleless and aggregate rules.
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
    SELECT
      split_part(entry.key, '.', 2) AS session_type,
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

COMMENT ON FUNCTION public.staff_tier_resource_metric_key(TEXT, UUID) IS
  'Builds the canonical subject-aware leaf key for a pay-tier resource metric.';

COMMENT ON FUNCTION public.compute_staff_tier_metrics(UUID) IS
  'Computes tenure, session, Homework Help, and subject-aware resource metrics, then applies additive overrides.';

WITH legacy_staff(first_name, last_name, employment_started_at, session_overrides) AS (
  VALUES
    ('Minah', 'Cho', '2024-07-23'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":106,"sessions.CLASS.TRIAL_TUTOR":1,"sessions.HOMEWORK_HELP.any":14}'::jsonb),
    ('Matthew', 'Chua', '2019-02-01'::timestamptz, '{"sessions.ADMIN_SHIFT.any":87,"sessions.CLASS.MAIN_TUTOR":364,"sessions.CLASS.SECONDARY_TUTOR":2,"sessions.HOMEWORK_HELP.any":34}'::jsonb),
    ('Alessia', 'D''Angelis', '2024-08-04'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":220,"sessions.CLASS.TRIAL_TUTOR":1}'::jsonb),
    ('Melshuel', 'George', '2025-02-16'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":57,"sessions.HOMEWORK_HELP.any":22}'::jsonb),
    ('Joshua', 'Gooi', '2021-04-08'::timestamptz, '{"sessions.ADMIN_SHIFT.any":2,"sessions.CLASS.MAIN_TUTOR":600,"sessions.CLASS.SECONDARY_TUTOR":8,"sessions.HOMEWORK_HELP.any":90}'::jsonb),
    ('Rongjun', 'He', '2023-07-12'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":252,"sessions.CLASS.TRIAL_TUTOR":6}'::jsonb),
    ('Huanzhen', 'Lin', '2024-05-24'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":422,"sessions.CLASS.TRIAL_TUTOR":1}'::jsonb),
    ('Kevin', 'Ling', '2021-04-11'::timestamptz, '{"sessions.ADMIN_SHIFT.any":2,"sessions.CLASS.MAIN_TUTOR":526,"sessions.CLASS.SECONDARY_TUTOR":14,"sessions.HOMEWORK_HELP.any":149}'::jsonb),
    ('Shardul', 'Mulye', '2022-09-18'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":467,"sessions.CLASS.SECONDARY_TUTOR":10,"sessions.HOMEWORK_HELP.any":188}'::jsonb),
    ('Lara', 'Nguyen', '2023-12-03'::timestamptz, '{"sessions.ADMIN_SHIFT.any":189,"sessions.CLASS.MAIN_TUTOR":14}'::jsonb),
    ('Ed', 'Nitschke', '2024-02-21'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":361,"sessions.HOMEWORK_HELP.any":3}'::jsonb),
    ('Maddie', 'Parker', '2025-05-21'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":82,"sessions.HOMEWORK_HELP.any":25}'::jsonb),
    ('Jayden', 'Tran', '2025-02-15'::timestamptz, '{"sessions.CLASS.MAIN_TUTOR":81}'::jsonb),
    ('Alexander', 'Wabnitz', '2021-11-25'::timestamptz, '{"sessions.ADMIN_SHIFT.any":4,"sessions.CLASS.MAIN_TUTOR":636,"sessions.CLASS.TRIAL_TUTOR":1,"sessions.HOMEWORK_HELP.any":3}'::jsonb)
),
legacy_resources(first_name, last_name, resource_type, subject_short_name, resource_count) AS (
  VALUES
    ('Minah', 'Cho', 'NOTES', 'UCAT', 13),
    ('Minah', 'Cho', 'PRACTICE_QUESTIONS', NULL, 1),
    ('Minah', 'Cho', 'SOLUTIONS', 'UCAT', 1),
    ('Matthew', 'Chua', 'NOTES', NULL, 1),
    ('Matthew', 'Chua', 'REVISION_SHEET', '12MATH', 1),
    ('Matthew', 'Chua', 'TEST', NULL, 1),
    ('Matthew', 'Chua', 'UNKNOWN', NULL, 41),
    ('Matthew', 'Chua', 'VIDEO', NULL, 1),
    ('Melshuel', 'George', 'NOTES', NULL, 1),
    ('Joshua', 'Gooi', 'EXAM', 'UCAT', 1),
    ('Joshua', 'Gooi', 'NOTES', 'UCAT', 24),
    ('Joshua', 'Gooi', 'PRACTICE_QUESTIONS', 'UCAT', 1),
    ('Joshua', 'Gooi', 'SOLUTIONS', 'UCAT', 1),
    ('Joshua', 'Gooi', 'TEST', '12BIOL', 1),
    ('Joshua', 'Gooi', 'TEST', NULL, 2),
    ('Joshua', 'Gooi', 'TEST', 'UCAT', 35),
    ('Joshua', 'Gooi', 'UNKNOWN', '12BIOL', 2),
    ('Joshua', 'Gooi', 'UNKNOWN', NULL, 8),
    ('Joshua', 'Gooi', 'UNKNOWN', 'UCAT', 12),
    ('Rongjun', 'He', 'PRACTICE_QUESTIONS', '11PHYS', 2),
    ('Rongjun', 'He', 'TEST', '11PHYS', 3),
    ('Rongjun', 'He', 'UNKNOWN', NULL, 3),
    ('Huanzhen', 'Lin', 'SOLUTIONS', '12CHEM', 1),
    ('Huanzhen', 'Lin', 'SOLUTIONS', '12MATH', 1),
    ('Huanzhen', 'Lin', 'SOLUTIONS', NULL, 3),
    ('Kevin', 'Ling', 'PRACTICE_QUESTIONS', NULL, 2),
    ('Kevin', 'Ling', 'SOLUTIONS', NULL, 2),
    ('Kevin', 'Ling', 'UNKNOWN', '11CHEM', 1),
    ('Kevin', 'Ling', 'UNKNOWN', 'MEDI', 1),
    ('Kevin', 'Ling', 'UNKNOWN', NULL, 6),
    ('Kevin', 'Ling', 'VIDEO', '12BIOL', 2),
    ('Kevin', 'Ling', 'VIDEO', '12CHEM', 3),
    ('Kevin', 'Ling', 'VIDEO', NULL, 3),
    ('Shardul', 'Mulye', 'EXAM', 'UCAT', 1),
    ('Shardul', 'Mulye', 'NOTES', 'UCAT', 34),
    ('Shardul', 'Mulye', 'PRACTICE_QUESTIONS', '12MATH', 1),
    ('Shardul', 'Mulye', 'PRACTICE_QUESTIONS', 'UCAT', 1),
    ('Shardul', 'Mulye', 'TEST', NULL, 1),
    ('Shardul', 'Mulye', 'TEST', 'UCAT', 43),
    ('Shardul', 'Mulye', 'UNKNOWN', NULL, 5),
    ('Shardul', 'Mulye', 'UNKNOWN', 'UCAT', 10),
    ('Ed', 'Nitschke', 'NOTES', '12MATH', 1),
    ('Ed', 'Nitschke', 'NOTES', 'UCAT', 1),
    ('Maddie', 'Parker', 'NOTES', 'UCAT', 3),
    ('Alexander', 'Wabnitz', 'EXAM', '12MATH', 2),
    ('Alexander', 'Wabnitz', 'EXAM', '12SPEC', 1),
    ('Alexander', 'Wabnitz', 'EXAM', NULL, 2),
    ('Alexander', 'Wabnitz', 'NOTES', '11PHYS', 1),
    ('Alexander', 'Wabnitz', 'NOTES', '12SPEC', 1),
    ('Alexander', 'Wabnitz', 'NOTES', NULL, 3),
    ('Alexander', 'Wabnitz', 'PRACTICE_QUESTIONS', '12SPEC', 7),
    ('Alexander', 'Wabnitz', 'PRACTICE_QUESTIONS', NULL, 4),
    ('Alexander', 'Wabnitz', 'REVISION_SHEET', '12SPEC', 1),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '11CHEM', 1),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '11MATH', 10),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '11PHYS', 3),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '11SPEC', 10),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '12MATH', 9),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '12PHYS', 2),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', '12SPEC', 18),
    ('Alexander', 'Wabnitz', 'SOLUTIONS', NULL, 20),
    ('Alexander', 'Wabnitz', 'TEST', '8MATH', 1),
    ('Alexander', 'Wabnitz', 'TEST', NULL, 3),
    ('Alexander', 'Wabnitz', 'UNKNOWN', NULL, 5),
    ('Alexander', 'Wabnitz', 'VIDEO', NULL, 1)
),
resource_overrides AS (
  SELECT
    legacy_resource.first_name,
    legacy_resource.last_name,
    jsonb_object_agg(
      public.staff_tier_resource_metric_key(legacy_resource.resource_type, subject.id),
      legacy_resource.resource_count
    ) AS metric_overrides
  FROM legacy_resources legacy_resource
  LEFT JOIN public.subjects subject
    ON subject.short_name = legacy_resource.subject_short_name
  GROUP BY legacy_resource.first_name, legacy_resource.last_name
)
UPDATE public.staff staff
SET
  employment_started_at = LEAST(staff.employment_started_at, legacy_staff.employment_started_at),
  metric_overrides = staff.metric_overrides
    || legacy_staff.session_overrides
    || COALESCE(resource_overrides.metric_overrides, '{}'::jsonb)
FROM legacy_staff
LEFT JOIN resource_overrides
  ON resource_overrides.first_name = legacy_staff.first_name
  AND resource_overrides.last_name = legacy_staff.last_name
WHERE staff.status = 'ACTIVE'
  AND staff.first_name = legacy_staff.first_name
  AND staff.last_name = legacy_staff.last_name;
