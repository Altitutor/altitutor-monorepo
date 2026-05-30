-- UCAT score predictor v1
-- Adds student study-planner settings and model priors configurable by admin staff.

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS ucat_test_date DATE,
  ADD COLUMN IF NOT EXISTS ucat_target_score_s1 NUMERIC,
  ADD COLUMN IF NOT EXISTS ucat_target_score_s2 NUMERIC,
  ADD COLUMN IF NOT EXISTS ucat_target_score_s3 NUMERIC;

COMMENT ON COLUMN public.students.ucat_test_date IS 'UCAT exam date chosen by student.';
COMMENT ON COLUMN public.students.ucat_target_score_s1 IS 'Target scaled score for section 1 (300-900).';
COMMENT ON COLUMN public.students.ucat_target_score_s2 IS 'Target scaled score for section 2 (300-900).';
COMMENT ON COLUMN public.students.ucat_target_score_s3 IS 'Target scaled score for section 3 (300-900).';

CREATE TABLE IF NOT EXISTS public.ucat_model_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL UNIQUE REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  k_prior DOUBLE PRECISION NOT NULL DEFAULT 0.000136,
  s_inf_uplift DOUBLE PRECISION NOT NULL DEFAULT 130,
  r_noise DOUBLE PRECISION NOT NULL DEFAULT 1600,
  p0 DOUBLE PRECISION NOT NULL DEFAULT 2500,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.ucat_model_config IS 'Cold-start UCAT prediction model priors (admin-editable) for sections 1-3.';
COMMENT ON COLUMN public.ucat_model_config.k_prior IS 'Cold-start learning-rate prior (exponential model).';
COMMENT ON COLUMN public.ucat_model_config.s_inf_uplift IS 'Cold-start projected ceiling uplift from initial score.';
COMMENT ON COLUMN public.ucat_model_config.r_noise IS 'Kalman measurement noise variance.';
COMMENT ON COLUMN public.ucat_model_config.p0 IS 'Kalman initial uncertainty variance.';

ALTER TABLE public.ucat_model_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ADMINSTAFF full access to ucat_model_config" ON public.ucat_model_config;
CREATE POLICY "ADMINSTAFF full access to ucat_model_config" ON public.ucat_model_config
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

DROP POLICY IF EXISTS "Authenticated read ucat_model_config" ON public.ucat_model_config;
CREATE POLICY "Authenticated read ucat_model_config" ON public.ucat_model_config
  FOR SELECT TO authenticated
  USING (true);

DROP TRIGGER IF EXISTS update_ucat_model_config_updated_at ON public.ucat_model_config;
CREATE TRIGGER update_ucat_model_config_updated_at
  BEFORE UPDATE ON public.ucat_model_config
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.ucat_model_config (
  section_id,
  k_prior,
  s_inf_uplift,
  r_noise,
  p0
)
SELECT
  s.id,
  CASE s.section_number
    WHEN 1 THEN 0.000136
    WHEN 2 THEN 0.000120
    WHEN 3 THEN 0.000150
    ELSE 0.000136
  END AS k_prior,
  CASE s.section_number
    WHEN 1 THEN 130
    WHEN 2 THEN 120
    WHEN 3 THEN 140
    ELSE 130
  END AS s_inf_uplift,
  1600,
  2500
FROM public.ucat_sections s
WHERE s.section_number BETWEEN 1 AND 3
ON CONFLICT (section_id) DO UPDATE
SET
  k_prior = EXCLUDED.k_prior,
  s_inf_uplift = EXCLUDED.s_inf_uplift,
  r_noise = EXCLUDED.r_noise,
  p0 = EXCLUDED.p0,
  updated_at = NOW();
