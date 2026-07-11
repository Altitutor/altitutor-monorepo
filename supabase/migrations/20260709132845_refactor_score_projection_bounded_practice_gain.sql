-- Replace fixed ceiling-uplift score projection with bounded cumulative
-- effective-practice gains. The new model lets sustained practice raise the
-- projected score while preserving diminishing returns and the 900 section cap.

ALTER TABLE public.ucat_score_projection_settings
  DROP CONSTRAINT IF EXISTS ucat_score_projection_settings_score_bounds,
  DROP CONSTRAINT IF EXISTS ucat_score_projection_settings_positive_weights;

ALTER TABLE public.ucat_score_projection_settings
  ADD COLUMN IF NOT EXISTS pessimistic_base_gain DOUBLE PRECISION NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS realistic_base_gain DOUBLE PRECISION NOT NULL DEFAULT 25,
  ADD COLUMN IF NOT EXISTS optimistic_base_gain DOUBLE PRECISION NOT NULL DEFAULT 40,
  ADD COLUMN IF NOT EXISTS pessimistic_room_fraction DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS realistic_room_fraction DOUBLE PRECISION NOT NULL DEFAULT 0.55,
  ADD COLUMN IF NOT EXISTS optimistic_room_fraction DOUBLE PRECISION NOT NULL DEFAULT 0.75,
  ADD COLUMN IF NOT EXISTS pessimistic_low_score_boost DOUBLE PRECISION NOT NULL DEFAULT 0.15,
  ADD COLUMN IF NOT EXISTS realistic_low_score_boost DOUBLE PRECISION NOT NULL DEFAULT 0.25,
  ADD COLUMN IF NOT EXISTS optimistic_low_score_boost DOUBLE PRECISION NOT NULL DEFAULT 0.35,
  ADD COLUMN IF NOT EXISTS pessimistic_effort_half_saturation DOUBLE PRECISION NOT NULL DEFAULT 850,
  ADD COLUMN IF NOT EXISTS realistic_effort_half_saturation DOUBLE PRECISION NOT NULL DEFAULT 650,
  ADD COLUMN IF NOT EXISTS optimistic_effort_half_saturation DOUBLE PRECISION NOT NULL DEFAULT 550;

ALTER TABLE public.ucat_score_projection_settings
  DROP COLUMN IF EXISTS pessimistic_learning_rate,
  DROP COLUMN IF EXISTS realistic_learning_rate,
  DROP COLUMN IF EXISTS optimistic_learning_rate,
  DROP COLUMN IF EXISTS pessimistic_ceiling_uplift,
  DROP COLUMN IF EXISTS realistic_ceiling_uplift,
  DROP COLUMN IF EXISTS optimistic_ceiling_uplift;

ALTER TABLE public.ucat_score_projection_settings
  ADD CONSTRAINT ucat_score_projection_settings_score_bounds CHECK (
    pessimistic_base_gain >= 0
    AND realistic_base_gain >= 0
    AND optimistic_base_gain >= 0
    AND pessimistic_room_fraction >= 0
    AND pessimistic_room_fraction <= 1
    AND realistic_room_fraction >= 0
    AND realistic_room_fraction <= 1
    AND optimistic_room_fraction >= 0
    AND optimistic_room_fraction <= 1
    AND pessimistic_low_score_boost >= 0
    AND realistic_low_score_boost >= 0
    AND optimistic_low_score_boost >= 0
    AND pessimistic_effort_half_saturation > 0
    AND realistic_effort_half_saturation > 0
    AND optimistic_effort_half_saturation > 0
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
  );

COMMENT ON COLUMN public.ucat_score_projection_settings.pessimistic_base_gain IS
  'Minimum possible score gain available to the lower projection curve before room-based upside.';
COMMENT ON COLUMN public.ucat_score_projection_settings.realistic_base_gain IS
  'Minimum possible score gain available to the central projection curve before room-based upside.';
COMMENT ON COLUMN public.ucat_score_projection_settings.optimistic_base_gain IS
  'Minimum possible score gain available to the upper projection curve before room-based upside.';
COMMENT ON COLUMN public.ucat_score_projection_settings.pessimistic_room_fraction IS
  'Share of remaining room to 900 that can become reachable under the lower projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.realistic_room_fraction IS
  'Share of remaining room to 900 that can become reachable under the central projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.optimistic_room_fraction IS
  'Share of remaining room to 900 that can become reachable under the upper projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.pessimistic_low_score_boost IS
  'Extra room-based upside for lower starting scores on the lower projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.realistic_low_score_boost IS
  'Extra room-based upside for lower starting scores on the central projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.optimistic_low_score_boost IS
  'Extra room-based upside for lower starting scores on the upper projection curve.';
COMMENT ON COLUMN public.ucat_score_projection_settings.pessimistic_effort_half_saturation IS
  'Effective practice units needed to realise half of the lower projection curve gain.';
COMMENT ON COLUMN public.ucat_score_projection_settings.realistic_effort_half_saturation IS
  'Effective practice units needed to realise half of the central projection curve gain.';
COMMENT ON COLUMN public.ucat_score_projection_settings.optimistic_effort_half_saturation IS
  'Effective practice units needed to realise half of the upper projection curve gain.';
