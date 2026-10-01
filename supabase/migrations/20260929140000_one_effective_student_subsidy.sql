-- One subsidy rate per student, subject, and billing type at any instant.
-- Existing overlaps are rewritten so the row with the latest effective_from
-- (then the greatest id) keeps each moment it already covered. A later bounded
-- rate therefore still gives way to the earlier rate once it ends.
-- Saving a subsidy makes every other row yield for that window.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.yield_student_subsidies_to_window(
  p_student_id uuid,
  p_subject_id uuid,
  p_billing_type public.billing_type,
  p_window_from timestamptz,
  p_window_until timestamptz,
  p_except_id uuid
) RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_window tstzrange;
  v_row public.student_subsidies%ROWTYPE;
  v_existing tstzrange;
  v_left tstzrange;
  v_right tstzrange;
BEGIN
  v_window := tstzrange(p_window_from, p_window_until, '[)');

  FOR v_row IN
    SELECT *
    FROM public.student_subsidies
    WHERE student_id = p_student_id
      AND subject_id = p_subject_id
      AND billing_type = p_billing_type
      AND (p_except_id IS NULL OR id <> p_except_id)
      AND tstzrange(effective_from, effective_until, '[)') && v_window
    FOR UPDATE
  LOOP
    v_existing := tstzrange(v_row.effective_from, v_row.effective_until, '[)');
    v_left := v_existing * tstzrange(NULL, lower(v_window), '[)');
    IF upper_inf(v_window) THEN
      v_right := 'empty'::tstzrange;
    ELSE
      v_right := v_existing * tstzrange(upper(v_window), NULL, '[)');
    END IF;

    IF isempty(v_left) AND isempty(v_right) THEN
      DELETE FROM public.student_subsidies WHERE id = v_row.id;
    ELSIF NOT isempty(v_left) AND isempty(v_right) THEN
      UPDATE public.student_subsidies
      SET effective_until = upper(v_left)
      WHERE id = v_row.id;
    ELSIF isempty(v_left) AND NOT isempty(v_right) THEN
      UPDATE public.student_subsidies
      SET effective_from = lower(v_right),
          effective_until = upper(v_right)
      WHERE id = v_row.id;
    ELSE
      UPDATE public.student_subsidies
      SET effective_until = upper(v_left)
      WHERE id = v_row.id;

      INSERT INTO public.student_subsidies (
        student_id,
        subject_id,
        billing_type,
        price_cents,
        currency,
        effective_from,
        effective_until,
        created_by
      ) VALUES (
        v_row.student_id,
        v_row.subject_id,
        v_row.billing_type,
        v_row.price_cents,
        v_row.currency,
        lower(v_right),
        upper(v_right),
        v_row.created_by
      );
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.yield_student_subsidies_to_window(
  uuid, uuid, public.billing_type, timestamptz, timestamptz, uuid
) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.resolve_overlapping_student_subsidies()
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_key record;
  v_row public.student_subsidies%ROWTYPE;
  v_painted jsonb;
  v_next jsonb;
  v_span tstzrange;
  v_existing tstzrange;
  v_left tstzrange;
  v_right tstzrange;
  v_elem jsonb;
  v_first boolean;
  v_lower timestamptz;
  v_upper timestamptz;
BEGIN
  FOR v_key IN
    SELECT DISTINCT a.student_id, a.subject_id, a.billing_type
    FROM public.student_subsidies a
    JOIN public.student_subsidies b
      ON a.student_id = b.student_id
     AND a.subject_id = b.subject_id
     AND a.billing_type = b.billing_type
     AND a.id <> b.id
     AND tstzrange(a.effective_from, a.effective_until, '[)')
         && tstzrange(b.effective_from, b.effective_until, '[)')
  LOOP
    v_painted := '[]'::jsonb;

    FOR v_row IN
      SELECT *
      FROM public.student_subsidies
      WHERE student_id = v_key.student_id
        AND subject_id = v_key.subject_id
        AND billing_type = v_key.billing_type
      ORDER BY effective_from ASC, id ASC
      FOR UPDATE
    LOOP
      v_span := tstzrange(v_row.effective_from, v_row.effective_until, '[)');
      v_next := '[]'::jsonb;

      FOR v_elem IN
        SELECT value
        FROM jsonb_array_elements(v_painted)
      LOOP
        v_existing := tstzrange(
          (v_elem->>'lower')::timestamptz,
          (v_elem->>'upper')::timestamptz,
          '[)'
        );
        v_left := v_existing * tstzrange(NULL, lower(v_span), '[)');
        IF upper_inf(v_span) THEN
          v_right := 'empty'::tstzrange;
        ELSE
          v_right := v_existing * tstzrange(upper(v_span), NULL, '[)');
        END IF;

        IF NOT isempty(v_left) THEN
          v_next := v_next || jsonb_build_array(jsonb_build_object(
            'source_id', v_elem->>'source_id',
            'lower', lower(v_left),
            'upper', upper(v_left)
          ));
        END IF;
        IF NOT isempty(v_right) THEN
          v_next := v_next || jsonb_build_array(jsonb_build_object(
            'source_id', v_elem->>'source_id',
            'lower', lower(v_right),
            'upper', upper(v_right)
          ));
        END IF;
      END LOOP;

      v_next := v_next || jsonb_build_array(jsonb_build_object(
        'source_id', v_row.id,
        'lower', lower(v_span),
        'upper', upper(v_span)
      ));
      v_painted := v_next;
    END LOOP;

    FOR v_row IN
      SELECT *
      FROM public.student_subsidies
      WHERE student_id = v_key.student_id
        AND subject_id = v_key.subject_id
        AND billing_type = v_key.billing_type
      ORDER BY id
    LOOP
      v_first := true;
      FOR v_lower, v_upper IN
        SELECT
          (elem->>'lower')::timestamptz,
          (elem->>'upper')::timestamptz
        FROM jsonb_array_elements(v_painted) AS elem
        WHERE (elem->>'source_id')::uuid = v_row.id
        ORDER BY 1
      LOOP
        IF v_first THEN
          IF v_row.effective_from IS DISTINCT FROM v_lower
             OR v_row.effective_until IS DISTINCT FROM v_upper THEN
            UPDATE public.student_subsidies
            SET effective_from = v_lower,
                effective_until = v_upper
            WHERE id = v_row.id;
          END IF;
          v_first := false;
        ELSE
          INSERT INTO public.student_subsidies (
            student_id,
            subject_id,
            billing_type,
            price_cents,
            currency,
            effective_from,
            effective_until,
            created_by
          ) VALUES (
            v_row.student_id,
            v_row.subject_id,
            v_row.billing_type,
            v_row.price_cents,
            v_row.currency,
            v_lower,
            v_upper,
            v_row.created_by
          );
        END IF;
      END LOOP;

      IF v_first THEN
        DELETE FROM public.student_subsidies WHERE id = v_row.id;
      END IF;
    END LOOP;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_overlapping_student_subsidies()
  FROM PUBLIC, anon, authenticated, service_role;

SELECT public.resolve_overlapping_student_subsidies();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.student_subsidies earlier
    JOIN public.student_subsidies later
      ON earlier.student_id = later.student_id
     AND earlier.subject_id = later.subject_id
     AND earlier.billing_type = later.billing_type
     AND earlier.id < later.id
     AND tstzrange(earlier.effective_from, earlier.effective_until, '[)')
         && tstzrange(later.effective_from, later.effective_until, '[)')
  ) THEN
    RAISE EXCEPTION 'student subsidy overlaps remain after resolution';
  END IF;
END $$;

ALTER TABLE public.student_subsidies
  ADD CONSTRAINT student_subsidies_no_overlap
  EXCLUDE USING gist (
    student_id WITH =,
    subject_id WITH =,
    billing_type WITH =,
    tstzrange(effective_from, effective_until, '[)') WITH &&
  ) DEFERRABLE INITIALLY IMMEDIATE;

COMMENT ON CONSTRAINT student_subsidies_no_overlap ON public.student_subsidies IS
  'A student has at most one subsidy for a subject and billing type at any instant. Adjacent ranges may meet at an endpoint.';

CREATE OR REPLACE FUNCTION public.save_student_subsidy(
  p_id uuid DEFAULT NULL,
  p_student_id uuid DEFAULT NULL,
  p_subject_id uuid DEFAULT NULL,
  p_billing_type public.billing_type DEFAULT NULL,
  p_price_cents integer DEFAULT NULL,
  p_currency text DEFAULT 'AUD',
  p_effective_from timestamptz DEFAULT NULL,
  p_effective_until timestamptz DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing public.student_subsidies%ROWTYPE;
  v_staff_id uuid;
  v_id uuid;
  v_currency text;
  v_overlaps boolean;
BEGIN
  IF NOT public.is_adminstaff_active() THEN
    RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
  END IF;

  IF p_student_id IS NULL OR p_subject_id IS NULL OR p_billing_type IS NULL
     OR p_price_cents IS NULL OR p_effective_from IS NULL THEN
    RAISE EXCEPTION 'Subsidy student, subject, billing type, price, and start are required'
      USING ERRCODE = '23514';
  END IF;

  IF p_price_cents < 0 THEN
    RAISE EXCEPTION 'Subsidy price cannot be negative' USING ERRCODE = '23514';
  END IF;

  IF p_effective_until IS NOT NULL AND p_effective_until <= p_effective_from THEN
    RAISE EXCEPTION 'Subsidy end must be after its start' USING ERRCODE = '23514';
  END IF;

  v_currency := COALESCE(NULLIF(btrim(p_currency), ''), 'AUD');

  SELECT id
  INTO v_staff_id
  FROM public.staff
  WHERE user_id = auth.uid()
    AND role = 'ADMINSTAFF'
    AND status = 'ACTIVE'
  LIMIT 1;

  IF p_id IS NOT NULL THEN
    SELECT *
    INTO v_existing
    FROM public.student_subsidies
    WHERE id = p_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Subsidy not found' USING ERRCODE = 'P0002';
    END IF;

    IF v_existing.student_id <> p_student_id THEN
      RAISE EXCEPTION 'Subsidy belongs to a different student' USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM public.student_subsidies existing
    WHERE existing.student_id = p_student_id
      AND existing.subject_id = p_subject_id
      AND existing.billing_type = p_billing_type
      AND (p_id IS NULL OR existing.id <> p_id)
      AND tstzrange(existing.effective_from, existing.effective_until, '[)')
          && tstzrange(p_effective_from, p_effective_until, '[)')
  ) INTO v_overlaps;

  IF p_id IS NOT NULL AND v_overlaps THEN
    DELETE FROM public.student_subsidies WHERE id = p_id;
    PERFORM public.yield_student_subsidies_to_window(
      p_student_id,
      p_subject_id,
      p_billing_type,
      p_effective_from,
      p_effective_until,
      NULL
    );
    INSERT INTO public.student_subsidies (
      id,
      student_id,
      subject_id,
      billing_type,
      price_cents,
      currency,
      effective_from,
      effective_until,
      created_by,
      created_at
    ) VALUES (
      p_id,
      p_student_id,
      p_subject_id,
      p_billing_type,
      p_price_cents,
      v_currency,
      p_effective_from,
      p_effective_until,
      v_existing.created_by,
      v_existing.created_at
    );
    RETURN p_id;
  END IF;

  IF p_id IS NULL OR v_overlaps THEN
    PERFORM public.yield_student_subsidies_to_window(
      p_student_id,
      p_subject_id,
      p_billing_type,
      p_effective_from,
      p_effective_until,
      p_id
    );
  END IF;

  IF p_id IS NULL THEN
    v_id := gen_random_uuid();
    INSERT INTO public.student_subsidies (
      id,
      student_id,
      subject_id,
      billing_type,
      price_cents,
      currency,
      effective_from,
      effective_until,
      created_by
    ) VALUES (
      v_id,
      p_student_id,
      p_subject_id,
      p_billing_type,
      p_price_cents,
      v_currency,
      p_effective_from,
      p_effective_until,
      v_staff_id
    );
    RETURN v_id;
  END IF;

  UPDATE public.student_subsidies
  SET subject_id = p_subject_id,
      billing_type = p_billing_type,
      price_cents = p_price_cents,
      currency = v_currency,
      effective_from = p_effective_from,
      effective_until = p_effective_until
  WHERE id = p_id;

  RETURN p_id;
END;
$$;

COMMENT ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) IS
  'Creates or updates a student subsidy and closes or splits any other subsidy for that student, subject, and billing type so the saved window is the only rate.';

REVOKE ALL ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) FROM PUBLIC, anon, service_role;
GRANT EXECUTE ON FUNCTION public.save_student_subsidy(
  uuid, uuid, uuid, public.billing_type, integer, text, timestamptz, timestamptz
) TO authenticated;

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
  v_student_id := public.current_student_id();
  IF v_student_id IS NULL THEN
    RAISE EXCEPTION 'Student not found';
  END IF;

  v_duration_hours := EXTRACT(EPOCH FROM (p_end_at - p_start_at)) / 3600.0;

  SELECT hourly_rate_cents, currency
  INTO v_default_pricing
  FROM public.billing_pricing
  WHERE billing_type = p_billing_type;

  IF v_default_pricing IS NULL THEN
    RAISE EXCEPTION 'Pricing not found for billing type %', p_billing_type;
  END IF;

  v_hourly_rate_cents := v_default_pricing.hourly_rate_cents;
  v_currency := LOWER(v_default_pricing.currency);

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

  SELECT price_cents, currency
  INTO v_subsidy
  FROM public.student_subsidies
  WHERE student_id = v_student_id
    AND subject_id = p_subject_id
    AND billing_type = p_billing_type
    AND effective_from <= p_start_at
    AND (effective_until IS NULL OR effective_until > p_start_at)
  ORDER BY effective_from DESC, id DESC
  LIMIT 1;

  IF v_subsidy IS NOT NULL THEN
    v_hourly_rate_cents := LEAST(v_hourly_rate_cents, v_subsidy.price_cents);
    IF v_subsidy.currency IS NOT NULL THEN
      v_currency := LOWER(v_subsidy.currency);
    END IF;
  END IF;

  v_amount_cents := ROUND(v_hourly_rate_cents * v_duration_hours)::INTEGER;

  RETURN json_build_object(
    'amount_cents', v_amount_cents,
    'currency', v_currency
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.calculate_session_price(
  uuid,
  public.billing_type,
  timestamptz,
  timestamptz
) TO authenticated;

COMMENT ON FUNCTION public.calculate_session_price IS
  'Calculate session price for a student. When several subsidies cover the session, the latest effective_from wins, then the greatest id.';

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
    ORDER BY ss.subject_id, ss.billing_type, ss.effective_from DESC, ss.id DESC
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
  'Student portal: active subsidies with standard hourly rate. One row per subject and billing type, preferring the latest effective_from.';
