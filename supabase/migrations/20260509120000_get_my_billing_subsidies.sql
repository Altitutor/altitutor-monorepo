-- Migration: Student portal — list active subsidies with standard hourly rate
-- Description:
--   Exposes SECURITY DEFINER RPC for billing page. Resolves standard rate using
--   billing_pricing + billing_pricing_overrides (same rules as calculate_session_price),
--   without granting students direct SELECT on those tables.

CREATE OR REPLACE FUNCTION public.get_my_billing_subsidies()
RETURNS TABLE (
  subject_id UUID,
  subject_long_name TEXT,
  billing_type public.billing_type,
  subsidy_hourly_cents INTEGER,
  standard_hourly_cents INTEGER,
  currency TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT public.current_student_id() AS sid
  ),
  active AS (
    SELECT DISTINCT ON (ss.subject_id, ss.billing_type)
      ss.subject_id,
      ss.billing_type,
      ss.price_cents,
      COALESCE(sj.long_name, sj.short_name, sj.name)::TEXT AS subject_long_name
    FROM public.student_subsidies ss
    INNER JOIN public.subjects sj ON sj.id = ss.subject_id
    CROSS JOIN me
    WHERE ss.student_id = me.sid
      AND me.sid IS NOT NULL
      AND ss.effective_from <= NOW()
      AND (ss.effective_until IS NULL OR ss.effective_until > NOW())
    ORDER BY ss.subject_id, ss.billing_type, ss.effective_from DESC
  )
  SELECT
    a.subject_id,
    a.subject_long_name,
    a.billing_type,
    a.price_cents AS subsidy_hourly_cents,
    COALESCE(o.hourly_rate_cents, bp.hourly_rate_cents) AS standard_hourly_cents,
    LOWER(
      CASE
        WHEN o.hourly_rate_cents IS NOT NULL THEN COALESCE(o.currency, bp.currency)
        ELSE bp.currency
      END
    )::TEXT AS currency
  FROM active a
  INNER JOIN public.billing_pricing bp ON bp.billing_type = a.billing_type
  LEFT JOIN public.billing_pricing_overrides o
    ON o.subject_id = a.subject_id
   AND o.billing_type = a.billing_type
   AND o.effective_from <= NOW()
   AND (o.effective_until IS NULL OR o.effective_until > NOW());
$$;

REVOKE ALL ON FUNCTION public.get_my_billing_subsidies() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_billing_subsidies() TO authenticated;

COMMENT ON FUNCTION public.get_my_billing_subsidies IS
  'Student portal: active subsidies with standard hourly rate (subject override or default) for comparison.';
