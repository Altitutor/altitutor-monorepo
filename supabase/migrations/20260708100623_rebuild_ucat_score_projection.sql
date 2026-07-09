-- Rebuild UCAT score projection from the former study-planner/model-config
-- surface. This deliberately removes target/date planning inputs; score
-- projection estimates current section scores and fixed-horizon trajectories.

DROP TABLE IF EXISTS public.ucat_model_config;

ALTER TABLE public.students
  DROP COLUMN IF EXISTS ucat_test_date,
  DROP COLUMN IF EXISTS ucat_test_year,
  DROP COLUMN IF EXISTS ucat_target_score_s1,
  DROP COLUMN IF EXISTS ucat_target_score_s2,
  DROP COLUMN IF EXISTS ucat_target_score_s3;

CREATE TABLE public.ucat_score_projection_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id UUID NOT NULL UNIQUE REFERENCES public.ucat_sections(id) ON DELETE CASCADE,
  mock_source_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  set_source_weight DOUBLE PRECISION NOT NULL DEFAULT 0.55,
  practice_source_weight DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  timed_weight DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  slow_timed_weight DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  untimed_weight DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  recency_half_life_days DOUBLE PRECISION NOT NULL DEFAULT 30,
  min_practice_scored_points NUMERIC NOT NULL DEFAULT 8,
  min_prediction_evidence_weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  default_effective_questions_per_week DOUBLE PRECISION NOT NULL DEFAULT 120,
  recent_activity_lookback_days INTEGER NOT NULL DEFAULT 21,
  effective_practice_daily_cap DOUBLE PRECISION NOT NULL DEFAULT 60,
  trajectory_horizon_days INTEGER NOT NULL DEFAULT 120,
  trajectory_step_days INTEGER NOT NULL DEFAULT 7,
  pessimistic_learning_rate DOUBLE PRECISION NOT NULL DEFAULT 0.0035,
  realistic_learning_rate DOUBLE PRECISION NOT NULL DEFAULT 0.006,
  optimistic_learning_rate DOUBLE PRECISION NOT NULL DEFAULT 0.009,
  pessimistic_ceiling_uplift NUMERIC NOT NULL DEFAULT 80,
  realistic_ceiling_uplift NUMERIC NOT NULL DEFAULT 130,
  optimistic_ceiling_uplift NUMERIC NOT NULL DEFAULT 180,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ucat_score_projection_settings_score_bounds CHECK (
    pessimistic_ceiling_uplift > 0
    AND realistic_ceiling_uplift > 0
    AND optimistic_ceiling_uplift > 0
  ),
  CONSTRAINT ucat_score_projection_settings_positive_weights CHECK (
    mock_source_weight > 0
    AND set_source_weight > 0
    AND practice_source_weight > 0
    AND timed_weight > 0
    AND slow_timed_weight > 0
    AND untimed_weight > 0
    AND recency_half_life_days > 0
    AND min_practice_scored_points > 0
    AND min_prediction_evidence_weight > 0
    AND default_effective_questions_per_week > 0
    AND recent_activity_lookback_days > 0
    AND effective_practice_daily_cap > 0
    AND trajectory_horizon_days > 0
    AND trajectory_step_days > 0
    AND pessimistic_learning_rate > 0
    AND realistic_learning_rate > 0
    AND optimistic_learning_rate > 0
  )
);

COMMENT ON TABLE public.ucat_score_projection_settings IS
  'Admin-editable assumptions for UCAT score projection by cognitive section.';
COMMENT ON COLUMN public.ucat_score_projection_settings.min_prediction_evidence_weight IS
  'Minimum effective evidence weight required before showing a predicted section score.';
COMMENT ON COLUMN public.ucat_score_projection_settings.default_effective_questions_per_week IS
  'Fallback effective-practice pace used when recent activity is too sparse.';

ALTER TABLE public.ucat_score_projection_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ADMINSTAFF full access to ucat_score_projection_settings"
  ON public.ucat_score_projection_settings
  FOR ALL TO authenticated
  USING ((SELECT public.is_adminstaff_active()))
  WITH CHECK ((SELECT public.is_adminstaff_active()));

CREATE POLICY "Authenticated read ucat_score_projection_settings"
  ON public.ucat_score_projection_settings
  FOR SELECT TO authenticated
  USING (true);

CREATE TRIGGER update_ucat_score_projection_settings_updated_at
  BEFORE UPDATE ON public.ucat_score_projection_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

INSERT INTO public.ucat_score_projection_settings (
  section_id,
  realistic_learning_rate,
  optimistic_learning_rate,
  pessimistic_learning_rate,
  realistic_ceiling_uplift,
  optimistic_ceiling_uplift,
  pessimistic_ceiling_uplift
)
SELECT
  s.id,
  CASE s.section_number
    WHEN 1 THEN 0.0055
    WHEN 2 THEN 0.006
    WHEN 3 THEN 0.0065
    ELSE 0.006
  END,
  CASE s.section_number
    WHEN 1 THEN 0.0085
    WHEN 2 THEN 0.009
    WHEN 3 THEN 0.0095
    ELSE 0.009
  END,
  CASE s.section_number
    WHEN 1 THEN 0.0032
    WHEN 2 THEN 0.0035
    WHEN 3 THEN 0.0038
    ELSE 0.0035
  END,
  CASE s.section_number
    WHEN 1 THEN 120
    WHEN 2 THEN 130
    WHEN 3 THEN 140
    ELSE 130
  END,
  CASE s.section_number
    WHEN 1 THEN 170
    WHEN 2 THEN 180
    WHEN 3 THEN 190
    ELSE 180
  END,
  CASE s.section_number
    WHEN 1 THEN 70
    WHEN 2 THEN 80
    WHEN 3 THEN 90
    ELSE 80
  END
FROM public.ucat_sections s
WHERE s.section_number BETWEEN 1 AND 3;
