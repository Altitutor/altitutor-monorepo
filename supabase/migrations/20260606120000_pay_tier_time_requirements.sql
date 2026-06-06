-- Migration: Pay tier time-based requirements
-- Description: Add TIME_SINCE_LAST_PROMOTION requirement kind and time-since-promotion metrics

ALTER TYPE public.staff_pay_tier_requirement_kind ADD VALUE IF NOT EXISTS 'TIME_SINCE_LAST_PROMOTION';

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
  v_count BIGINT;
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
BEGIN
  IF NOT public.is_adminstaff_active() AND public.current_staff_id() IS DISTINCT FROM p_staff_id THEN
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

  FOR v_row IN
    SELECT
      s.type::text AS session_type,
      tlsa.type::text AS attendance_type,
      COUNT(*)::bigint AS cnt
    FROM public.tutor_logs tl
    INNER JOIN public.sessions s ON s.id = tl.session_id
    INNER JOIN public.tutor_logs_staff_attendance tlsa
      ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
    GROUP BY s.type, tlsa.type
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, v_row.attendance_type);
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  FOR v_row IN
    SELECT s.type::text AS session_type, COUNT(*)::bigint AS cnt
    FROM public.tutor_logs tl
    INNER JOIN public.sessions s ON s.id = tl.session_id
    INNER JOIN public.tutor_logs_staff_attendance tlsa
      ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
    GROUP BY s.type
  LOOP
    v_key := public.staff_tier_session_metric_key(v_row.session_type, 'any');
    v_metrics := v_metrics || jsonb_build_object(v_key, v_row.cnt);
  END LOOP;

  SELECT COUNT(*)::bigint INTO v_count
  FROM public.tutor_logs tl
  INNER JOIN public.sessions s ON s.id = tl.session_id
  INNER JOIN public.tutor_logs_staff_attendance tlsa
    ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
  WHERE s.type IN ('CLASS', 'DRAFTING', 'EXAM_COURSE');

  v_metrics := v_metrics || jsonb_build_object('sessions.teaching.all', v_count);

  SELECT COUNT(*)::bigint INTO v_count
  FROM public.tutor_logs tl
  INNER JOIN public.sessions s ON s.id = tl.session_id
  INNER JOIN public.tutor_logs_staff_attendance tlsa
    ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
  WHERE s.type IN ('ADMIN_SHIFT', 'ADMIN_MEETING');

  v_metrics := v_metrics || jsonb_build_object('sessions.admin.all', v_count);

  IF v_overrides IS NOT NULL AND v_overrides <> '{}'::jsonb THEN
    FOR v_override_key, v_override_val IN
      SELECT key, value::text::numeric FROM jsonb_each(v_overrides)
    LOOP
      v_metrics := v_metrics || jsonb_build_object(
        v_override_key,
        COALESCE((v_metrics ->> v_override_key)::numeric, 0) + v_override_val
      );
    END LOOP;
  END IF;

  RETURN v_metrics;
END;
$$;
