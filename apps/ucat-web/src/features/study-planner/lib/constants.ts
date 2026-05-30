export const MODEL_DEFAULTS = {
  MIN_OBS_FOR_REFIT: 5,
  MIN_OBS_FOR_STABLE_TRAJECTORY: 8,
  MAX_DAILY_QUESTIONS: 200,
  CONE_Z_SCORE: 1.5,
  DELTA_K_FRACTION: 0.25,
  ASSUMED_DAILY_QUESTIONS: 50,
  MAX_REFIT_K_MULTIPLIER: 2.5,
  MAX_REFIT_SINF_UPLIFT: 220,
  SCORE_MIN: 300,
  SCORE_MAX: 900,
} as const;

export type TrajectoryStatus = "ahead" | "on_track" | "behind" | "at_risk";

export type ProjectionWarning =
  | "low_data"
  | "ceiling_limited"
  | "high_required_pace";
