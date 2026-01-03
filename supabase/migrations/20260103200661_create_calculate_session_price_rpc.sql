-- Migration: Create RPC function for students to calculate session price
-- Description: Allows students to calculate the price for a session, taking into account
--              default pricing, subject overrides, and student subsidies

CREATE OR REPLACE FUNCTION public.calculate_session_price(
  p_subject_id UUID,
  p_billing_type public.billing_type,
  p_start_at TIMESTAMPTZ,
  p_end_at TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student_id UUID;
  v_duration_hours NUMERIC;
  v_hourly_rate_cents INTEGER;
  v_currency TEXT;
  v_amount_cents INTEGER;
  v_default_pricing RECORD;
  v_override RECORD;
  v_subsidy RECORD;
BEGIN
  -- Get current student ID
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  -- Calculate duration in hours
  v_duration_hours := EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 3600.0;

  -- Get default pricing for billing type
  SELECT hourly_rate_cents, currency
  INTO v_default_pricing
  FROM public.billing_pricing
  WHERE billing_type = p_billing_type;

  IF v_default_pricing IS NULL THEN
    RAISE EXCEPTION 'Pricing not found for billing type %', p_billing_type;
  END IF;

  v_hourly_rate_cents := v_default_pricing.hourly_rate_cents;
  v_currency := LOWER(v_default_pricing.currency);

  -- Check for subject-specific override
  SELECT hourly_rate_cents, currency
  INTO v_override
  FROM public.billing_pricing_overrides
  WHERE subject_id = p_subject_id
    AND billing_type = p_billing_type
    AND effective_from <= p_start_at
    AND (effective_until IS NULL OR effective_until > p_start_at);

  IF v_override IS NOT NULL THEN
    v_hourly_rate_cents := v_override.hourly_rate_cents;
    IF v_override.currency IS NOT NULL THEN
      v_currency := LOWER(v_override.currency);
    END IF;
  END IF;

  -- Check for student subsidy (hourly rate override)
  SELECT price_cents, currency
  INTO v_subsidy
  FROM public.student_subsidies
  WHERE student_id = v_student_id
    AND subject_id = p_subject_id
    AND billing_type = p_billing_type
    AND effective_from <= p_start_at
    AND (effective_until IS NULL OR effective_until > p_start_at)
  ORDER BY effective_from DESC
  LIMIT 1;

  IF v_subsidy IS NOT NULL THEN
    -- Use the minimum of subsidy rate and current rate
    v_hourly_rate_cents := LEAST(v_hourly_rate_cents, v_subsidy.price_cents);
    IF v_subsidy.currency IS NOT NULL THEN
      v_currency := LOWER(v_subsidy.currency);
    END IF;
  END IF;

  -- Calculate total: hourly_rate * duration (rounded to nearest cent)
  v_amount_cents := ROUND(v_hourly_rate_cents * v_duration_hours)::INTEGER;

  -- Return as JSON
  RETURN json_build_object(
    'amount_cents', v_amount_cents,
    'currency', v_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_session_price TO authenticated;

COMMENT ON FUNCTION public.calculate_session_price IS 'Calculate session price for a student, taking into account default pricing, subject overrides, and student subsidies';
