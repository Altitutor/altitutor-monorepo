-- Gate UCAT score projection display by effective evidence weight instead of
-- shrinking sparse estimates toward a baseline score.

ALTER TABLE public.ucat_score_projection_settings
  ADD COLUMN IF NOT EXISTS min_prediction_evidence_weight DOUBLE PRECISION NOT NULL DEFAULT 1,
  DROP COLUMN IF EXISTS baseline_score,
  DROP COLUMN IF EXISTS shrinkage_prior_weight;

ALTER TABLE public.ucat_score_projection_settings
  DROP CONSTRAINT IF EXISTS ucat_score_projection_settings_score_bounds,
  DROP CONSTRAINT IF EXISTS ucat_score_projection_settings_positive_weights;

ALTER TABLE public.ucat_score_projection_settings
  ADD CONSTRAINT ucat_score_projection_settings_score_bounds CHECK (
    pessimistic_ceiling_uplift > 0
    AND realistic_ceiling_uplift > 0
    AND optimistic_ceiling_uplift > 0
  ),
  ADD CONSTRAINT ucat_score_projection_settings_positive_weights CHECK (
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
  );

COMMENT ON COLUMN public.ucat_score_projection_settings.min_prediction_evidence_weight IS
  'Minimum effective evidence weight required before showing a predicted section score.';
