-- UCAT Free quota resets.
--
-- Student-held entitlements are explicit-use only and reset all free quota
-- areas at once when consumed. Admin resets are immediate operational
-- adjustments and may target a single quota area.

CREATE TABLE IF NOT EXISTS public.ucat_free_quota_reset_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  granted_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  used_by_student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ucat_free_quota_reset_entitlements_used_requires_student
    CHECK ((used_at IS NULL AND used_by_student_id IS NULL) OR (used_at IS NOT NULL AND used_by_student_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_ucat_free_quota_reset_entitlements_student_active
  ON public.ucat_free_quota_reset_entitlements(student_id, expires_at, created_at)
  WHERE used_at IS NULL;

CREATE TABLE IF NOT EXISTS public.ucat_free_quota_reset_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  quota_area TEXT,
  reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  entitlement_id UUID REFERENCES public.ucat_free_quota_reset_entitlements(id) ON DELETE SET NULL,
  created_by_staff_id UUID REFERENCES public.staff(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT ucat_free_quota_reset_events_area_check
    CHECK (quota_area IS NULL OR quota_area IN ('practice', 'sets', 'mocks', 'learn', 'skill_trainer')),
  CONSTRAINT ucat_free_quota_reset_events_source_check
    CHECK (source IN ('student_entitlement', 'admin')),
  CONSTRAINT ucat_free_quota_reset_events_student_source_check
    CHECK (
      (source = 'student_entitlement' AND quota_area IS NULL AND entitlement_id IS NOT NULL)
      OR
      (source = 'admin' AND quota_area IS NOT NULL AND entitlement_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_ucat_free_quota_reset_events_student_area_reset
  ON public.ucat_free_quota_reset_events(student_id, quota_area, reset_at DESC);

ALTER TABLE public.ucat_free_quota_reset_entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ucat_free_quota_reset_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat free quota reset entitlements"
  ON public.ucat_free_quota_reset_entitlements;
CREATE POLICY "ADMINSTAFF full access to ucat free quota reset entitlements"
  ON public.ucat_free_quota_reset_entitlements
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Students can read own ucat free quota reset entitlements"
  ON public.ucat_free_quota_reset_entitlements;
CREATE POLICY "Students can read own ucat free quota reset entitlements"
  ON public.ucat_free_quota_reset_entitlements
  FOR SELECT
  TO authenticated
  USING (student_id = (SELECT public.current_student_id()));

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat free quota reset events"
  ON public.ucat_free_quota_reset_events;
CREATE POLICY "ADMINSTAFF full access to ucat free quota reset events"
  ON public.ucat_free_quota_reset_events
  FOR ALL
  TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP FUNCTION IF EXISTS public.get_ucat_free_quota_reset_boundary(UUID, TEXT);
CREATE OR REPLACE FUNCTION public.get_ucat_free_quota_reset_boundary(
  p_student_id UUID,
  p_quota_area TEXT
)
RETURNS TIMESTAMPTZ
LANGUAGE sql
STABLE
AS $$
  SELECT max(reset_at)
  FROM public.ucat_free_quota_reset_events
  WHERE student_id = p_student_id
    AND (quota_area IS NULL OR quota_area = p_quota_area);
$$;

DROP FUNCTION IF EXISTS public.use_ucat_free_quota_reset_entitlement(UUID);
CREATE OR REPLACE FUNCTION public.use_ucat_free_quota_reset_entitlement(
  p_student_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
  v_entitlement_id UUID;
  v_now TIMESTAMPTZ := now();
BEGIN
  SELECT id
  INTO v_entitlement_id
  FROM public.ucat_free_quota_reset_entitlements
  WHERE student_id = p_student_id
    AND used_at IS NULL
    AND expires_at >= v_now
  ORDER BY expires_at ASC, created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_entitlement_id IS NULL THEN
    RETURN NULL;
  END IF;

  UPDATE public.ucat_free_quota_reset_entitlements
  SET used_at = v_now,
      used_by_student_id = p_student_id,
      updated_at = v_now
  WHERE id = v_entitlement_id;

  INSERT INTO public.ucat_free_quota_reset_events (
    student_id,
    quota_area,
    reset_at,
    source,
    entitlement_id
  )
  VALUES (
    p_student_id,
    NULL,
    v_now,
    'student_entitlement',
    v_entitlement_id
  );

  RETURN v_entitlement_id;
END;
$$;

COMMENT ON TABLE public.ucat_free_quota_reset_entitlements IS
  'Student-held explicit-use UCAT Free quota reset entitlements. Consuming one resets all quota areas without deleting history.';
COMMENT ON TABLE public.ucat_free_quota_reset_events IS
  'Quota counting boundaries created by student entitlement use or admin single-area reset actions.';
COMMENT ON FUNCTION public.get_ucat_free_quota_reset_boundary(UUID, TEXT) IS
  'Latest quota reset boundary for a student and UCAT Free quota area.';
COMMENT ON FUNCTION public.use_ucat_free_quota_reset_entitlement(UUID) IS
  'Atomically consumes the earliest-expiring available UCAT Free quota reset entitlement for a student and records the all-area reset event.';

REVOKE EXECUTE ON FUNCTION public.get_ucat_free_quota_reset_boundary(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.use_ucat_free_quota_reset_entitlement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ucat_free_quota_reset_boundary(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.use_ucat_free_quota_reset_entitlement(UUID) TO service_role;
