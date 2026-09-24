-- Durable first-touch and self-reported acquisition attribution for each
-- student's Altitutor UCAT relationship.

ALTER TABLE public.students
  DROP CONSTRAINT IF EXISTS students_ucat_signup_step_check;

-- The new required acquisition-source step sits after password. Completed
-- signups stay completed; incomplete signups at the old sampler/plan frontier
-- return to the new step rather than silently bypassing it.
UPDATE public.students
SET ucat_signup_step = CASE
  WHEN ucat_signup_completed_at IS NOT NULL THEN 5
  WHEN ucat_signup_step >= 3 THEN 3
  ELSE ucat_signup_step
END
WHERE ucat_signup_step IS DISTINCT FROM CASE
  WHEN ucat_signup_completed_at IS NOT NULL THEN 5
  WHEN ucat_signup_step >= 3 THEN 3
  ELSE ucat_signup_step
END;

ALTER TABLE public.students
  ADD CONSTRAINT students_ucat_signup_step_check
  CHECK (ucat_signup_step BETWEEN 1 AND 5);

COMMENT ON COLUMN public.students.ucat_signup_step IS
  'Persisted Altitutor UCAT signup step: 1 details, 2 password, 3 acquisition source, 4 guided sampler, 5 plan.';

CREATE TABLE public.student_product_acquisition_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  product TEXT NOT NULL CHECK (product IN ('UCAT_WEB', 'STUDENT_WEB')),
  first_utm_source TEXT,
  first_utm_medium TEXT,
  first_utm_campaign TEXT,
  first_utm_content TEXT,
  first_utm_term TEXT,
  first_referrer_domain TEXT,
  first_landing_path TEXT,
  first_touch_captured_at TIMESTAMPTZ,
  self_reported_sources TEXT[],
  self_reported_other TEXT,
  self_reported_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT student_product_acquisition_attributions_student_product_key
    UNIQUE (student_id, product),
  CONSTRAINT student_product_acquisition_sources_allowed_check CHECK (
    self_reported_sources IS NULL
    OR self_reported_sources <@ ARRAY[
      'reddit',
      'tiktok',
      'instagram',
      'facebook',
      'search',
      'friend_or_classmate',
      'altitutor_tutor',
      'school_or_teacher',
      'business_card_or_flyer',
      'other',
      'not_sure'
    ]::TEXT[]
  ),
  CONSTRAINT student_product_acquisition_not_sure_exclusive_check CHECK (
    self_reported_sources IS NULL
    OR NOT ('not_sure' = ANY(self_reported_sources))
    OR cardinality(self_reported_sources) = 1
  ),
  CONSTRAINT student_product_acquisition_self_report_consistent_check CHECK (
    (self_reported_sources IS NULL AND self_reported_at IS NULL)
    OR (cardinality(self_reported_sources) > 0 AND self_reported_at IS NOT NULL)
  ),
  CONSTRAINT student_product_acquisition_other_consistent_check CHECK (
    self_reported_other IS NULL
    OR (
      self_reported_sources IS NOT NULL
      AND 'other' = ANY(self_reported_sources)
      AND length(self_reported_other) BETWEEN 1 AND 500
    )
  ),
  CONSTRAINT student_product_acquisition_utm_lengths_check CHECK (
    COALESCE(length(first_utm_source), 0) <= 256
    AND COALESCE(length(first_utm_medium), 0) <= 256
    AND COALESCE(length(first_utm_campaign), 0) <= 256
    AND COALESCE(length(first_utm_content), 0) <= 256
    AND COALESCE(length(first_utm_term), 0) <= 256
    AND COALESCE(length(first_referrer_domain), 0) <= 253
    AND COALESCE(length(first_landing_path), 0) <= 1024
  )
);

CREATE INDEX student_product_acquisition_attributions_product_idx
  ON public.student_product_acquisition_attributions (product, created_at DESC);

CREATE TRIGGER update_student_product_acquisition_attributions_updated_at
  BEFORE UPDATE ON public.student_product_acquisition_attributions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.preserve_product_acquisition_first_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  IF OLD.first_touch_captured_at IS NOT NULL AND (
    NEW.first_utm_source IS DISTINCT FROM OLD.first_utm_source
    OR NEW.first_utm_medium IS DISTINCT FROM OLD.first_utm_medium
    OR NEW.first_utm_campaign IS DISTINCT FROM OLD.first_utm_campaign
    OR NEW.first_utm_content IS DISTINCT FROM OLD.first_utm_content
    OR NEW.first_utm_term IS DISTINCT FROM OLD.first_utm_term
    OR NEW.first_referrer_domain IS DISTINCT FROM OLD.first_referrer_domain
    OR NEW.first_landing_path IS DISTINCT FROM OLD.first_landing_path
    OR NEW.first_touch_captured_at IS DISTINCT FROM OLD.first_touch_captured_at
  ) THEN
    RAISE EXCEPTION 'Observed acquisition first touch is immutable';
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER preserve_product_acquisition_first_touch
  BEFORE UPDATE ON public.student_product_acquisition_attributions
  FOR EACH ROW EXECUTE FUNCTION public.preserve_product_acquisition_first_touch();

ALTER TABLE public.student_product_acquisition_attributions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.student_product_acquisition_attributions
  FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.student_product_acquisition_attributions TO service_role;
GRANT SELECT ON public.student_product_acquisition_attributions TO authenticated;

CREATE POLICY "ADMINSTAFF can read acquisition attributions"
  ON public.student_product_acquisition_attributions
  FOR SELECT TO authenticated
  USING ((SELECT public.is_adminstaff_active()));

COMMENT ON TABLE public.student_product_acquisition_attributions IS
  'One durable acquisition record per Student and Product. Observed first touch is immutable; self-reported sources may be corrected.';
COMMENT ON COLUMN public.student_product_acquisition_attributions.self_reported_sources IS
  'One or more channels the Student says first made them aware of the Product; not_sure is exclusive.';
