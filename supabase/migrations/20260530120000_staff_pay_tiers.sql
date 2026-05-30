-- Migration: Staff pay tiers system
-- Description: Ladder config, per-staff tier state, promotion reviews, metric RPC

-- ========================
-- ENUMS
-- ========================
DO $$ BEGIN
  CREATE TYPE public.staff_pay_tier_requirement_kind AS ENUM (
    'TENURE_DAYS',
    'TENURE_MONTHS',
    'SESSION_COUNT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.staff_tier_promotion_outcome AS ENUM (
    'approved',
    'deferred',
    'not_ready'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ========================
-- staff_pay_tiers
-- ========================
CREATE TABLE IF NOT EXISTS public.staff_pay_tiers (
  tier_number INTEGER PRIMARY KEY CHECK (tier_number >= 1),
  name TEXT,
  base_pay_rate_cents INTEGER NOT NULL CHECK (base_pay_rate_cents >= 0),
  currency TEXT NOT NULL DEFAULT 'AUD',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS set_updated_at_staff_pay_tiers ON public.staff_pay_tiers;
CREATE TRIGGER set_updated_at_staff_pay_tiers
  BEFORE UPDATE ON public.staff_pay_tiers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.staff_pay_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_pay_tiers" ON public.staff_pay_tiers;
CREATE POLICY "ADMINSTAFF full access to staff_pay_tiers" ON public.staff_pay_tiers
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP POLICY IF EXISTS "Tutors read staff_pay_tiers" ON public.staff_pay_tiers;
CREATE POLICY "Tutors read staff_pay_tiers" ON public.staff_pay_tiers
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'user_metadata' ->> 'user_role') = 'TUTOR'
    OR (SELECT auth.jwt() ->> 'user_role') = 'TUTOR'
  );

-- ========================
-- staff_pay_tier_requirements
-- ========================
CREATE TABLE IF NOT EXISTS public.staff_pay_tier_requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_number INTEGER NOT NULL REFERENCES public.staff_pay_tiers(tier_number) ON DELETE CASCADE,
  requirement_kind public.staff_pay_tier_requirement_kind NOT NULL,
  params JSONB NOT NULL DEFAULT '{}'::jsonb,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT staff_pay_tier_requirements_params_object CHECK (jsonb_typeof(params) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_staff_pay_tier_requirements_tier_number
  ON public.staff_pay_tier_requirements(tier_number);

DROP TRIGGER IF EXISTS set_updated_at_staff_pay_tier_requirements ON public.staff_pay_tier_requirements;
CREATE TRIGGER set_updated_at_staff_pay_tier_requirements
  BEFORE UPDATE ON public.staff_pay_tier_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

ALTER TABLE public.staff_pay_tier_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_pay_tier_requirements" ON public.staff_pay_tier_requirements;
CREATE POLICY "ADMINSTAFF full access to staff_pay_tier_requirements" ON public.staff_pay_tier_requirements
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP POLICY IF EXISTS "Tutors read staff_pay_tier_requirements" ON public.staff_pay_tier_requirements;
CREATE POLICY "Tutors read staff_pay_tier_requirements" ON public.staff_pay_tier_requirements
  FOR SELECT TO authenticated
  USING (
    (SELECT auth.jwt() -> 'user_metadata' ->> 'user_role') = 'TUTOR'
    OR (SELECT auth.jwt() ->> 'user_role') = 'TUTOR'
  );

-- ========================
-- Seed default tiers (before staff FK)
-- ========================
INSERT INTO public.staff_pay_tiers (tier_number, name, base_pay_rate_cents, currency)
VALUES
  (1, 'Tier 1', 2500, 'AUD'),
  (2, 'Tier 2', 2750, 'AUD'),
  (3, 'Tier 3', 3000, 'AUD'),
  (4, 'Tier 4', 3250, 'AUD'),
  (5, 'Tier 5', 3500, 'AUD'),
  (6, 'Tier 6', 3750, 'AUD'),
  (7, 'Tier 7', 4000, 'AUD'),
  (8, 'Tier 8', 4250, 'AUD'),
  (9, 'Tier 9', 4500, 'AUD'),
  (10, 'Tier 10', 4750, 'AUD'),
  (11, 'Tier 11', 5000, 'AUD')
ON CONFLICT (tier_number) DO NOTHING;

-- ========================
-- staff columns
-- ========================
ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS current_tier_number INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS employment_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS metric_overrides JSONB DEFAULT '{}'::jsonb;

UPDATE public.staff SET current_tier_number = 1 WHERE current_tier_number IS NULL;
UPDATE public.staff SET employment_started_at = created_at WHERE employment_started_at IS NULL;
UPDATE public.staff SET metric_overrides = '{}'::jsonb WHERE metric_overrides IS NULL;

ALTER TABLE public.staff
  ALTER COLUMN current_tier_number SET NOT NULL,
  ALTER COLUMN current_tier_number SET DEFAULT 1,
  ALTER COLUMN employment_started_at SET NOT NULL,
  ALTER COLUMN employment_started_at SET DEFAULT NOW(),
  ALTER COLUMN metric_overrides SET NOT NULL,
  ALTER COLUMN metric_overrides SET DEFAULT '{}'::jsonb;

CREATE OR REPLACE FUNCTION public.staff_default_employment_started_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.employment_started_at IS NULL THEN
    NEW.employment_started_at := COALESCE(NEW.created_at, NOW());
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS staff_default_employment_started_at ON public.staff;
CREATE TRIGGER staff_default_employment_started_at
  BEFORE INSERT ON public.staff
  FOR EACH ROW
  EXECUTE FUNCTION public.staff_default_employment_started_at();

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_current_tier_number_fkey;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_current_tier_number_fkey
  FOREIGN KEY (current_tier_number) REFERENCES public.staff_pay_tiers(tier_number);

ALTER TABLE public.staff
  DROP CONSTRAINT IF EXISTS staff_metric_overrides_object;

ALTER TABLE public.staff
  ADD CONSTRAINT staff_metric_overrides_object CHECK (jsonb_typeof(metric_overrides) = 'object');

COMMENT ON COLUMN public.staff.current_tier_number IS 'Current pay tier on the org ladder';
COMMENT ON COLUMN public.staff.employment_started_at IS 'Start date for tenure-based tier requirements';
COMMENT ON COLUMN public.staff.metric_overrides IS 'Additive overrides keyed by staff tier metric id';

-- ========================
-- staff_tier_promotions
-- ========================
CREATE TABLE IF NOT EXISTS public.staff_tier_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  from_tier_number INTEGER NOT NULL,
  to_tier_number INTEGER NOT NULL,
  check_in_session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  outcome public.staff_tier_promotion_outcome NOT NULL,
  notes TEXT,
  reviewed_by UUID NOT NULL REFERENCES public.staff(id),
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_staff_tier_promotions_staff_id
  ON public.staff_tier_promotions(staff_id, reviewed_at DESC);

ALTER TABLE public.staff_tier_promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to staff_tier_promotions" ON public.staff_tier_promotions;
CREATE POLICY "ADMINSTAFF full access to staff_tier_promotions" ON public.staff_tier_promotions
  FOR ALL TO authenticated
  USING (public.is_adminstaff_active())
  WITH CHECK (public.is_adminstaff_active());

DROP POLICY IF EXISTS "Tutors read own staff_tier_promotions" ON public.staff_tier_promotions;
CREATE POLICY "Tutors read own staff_tier_promotions" ON public.staff_tier_promotions
  FOR SELECT TO authenticated
  USING (staff_id = public.current_staff_id());

-- ========================
-- Metric helpers
-- ========================
CREATE OR REPLACE FUNCTION public.staff_tier_session_metric_key(
  p_session_type TEXT,
  p_attendance_type TEXT
)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT 'sessions.' || p_session_type || '.' || COALESCE(NULLIF(p_attendance_type, ''), 'any');
$$;

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
  v_tenure_months INTEGER;
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
  v_tenure_months := (
    EXTRACT(YEAR FROM age(CURRENT_DATE, v_employment_started_at::date))::int * 12
    + EXTRACT(MONTH FROM age(CURRENT_DATE, v_employment_started_at::date))::int
  );

  v_metrics := v_metrics || jsonb_build_object('tenure.days', v_tenure_days, 'tenure.months', v_tenure_months);

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

  -- sessions.{type}.any per session type
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

  -- Teaching aggregate
  SELECT COUNT(*)::bigint INTO v_count
  FROM public.tutor_logs tl
  INNER JOIN public.sessions s ON s.id = tl.session_id
  INNER JOIN public.tutor_logs_staff_attendance tlsa
    ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
  WHERE s.type IN ('CLASS', 'DRAFTING', 'EXAM_COURSE');

  v_metrics := v_metrics || jsonb_build_object('sessions.teaching.all', v_count);

  -- Admin aggregate (ADMIN_SHIFT + ADMIN_MEETING)
  SELECT COUNT(*)::bigint INTO v_count
  FROM public.tutor_logs tl
  INNER JOIN public.sessions s ON s.id = tl.session_id
  INNER JOIN public.tutor_logs_staff_attendance tlsa
    ON tlsa.tutor_log_id = tl.id AND tlsa.staff_id = p_staff_id AND tlsa.attended = TRUE
  WHERE s.type IN ('ADMIN_SHIFT', 'ADMIN_MEETING');

  v_metrics := v_metrics || jsonb_build_object('sessions.admin.all', v_count);

  -- Apply additive overrides
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

GRANT EXECUTE ON FUNCTION public.compute_staff_tier_metrics(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.staff_tier_session_metric_key(TEXT, TEXT) TO authenticated;

-- Tutors: read own tier fields on staff (existing self-read policy should cover; allow update only admin via API)
DROP POLICY IF EXISTS "ADMINSTAFF update staff tier fields" ON public.staff;
-- Staff update remains via existing ADMINSTAFF policies
