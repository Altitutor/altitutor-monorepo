import type {
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  SkillTrainerConfigSnapshot,
  UcatSkillTrainerKey,
} from "@altitutor/shared";

/**
 * Per-trainer scale so typical high scores land in a similar band (~150–350).
 * Tuned heuristically from action frequency and base point values.
 */
const TRAINER_SCORE_SCALE: Record<UcatSkillTrainerKey, number> = {
  find_word: 0.45,
  find_concept: 0.45,
  quick_syllogism: 1.0,
  mental_maths: 0.85,
  numpad_speed: 1.1,
  calculator_maths: 1.0,
};

export function normalizeScoreDelta(
  trainerKey: UcatSkillTrainerKey,
  delta: number,
): number {
  if (delta === 0) return 0;
  const scaled = delta * TRAINER_SCORE_SCALE[trainerKey];
  return delta > 0 ? Math.max(1, Math.round(scaled)) : Math.round(scaled);
}

export function getStreakMultiplier(
  streak: number,
  steps: SkillTrainerConfigSnapshot["streak_multiplier_steps"],
): number {
  let multiplier = 1;
  for (const step of steps) {
    if (streak >= step.min_streak) {
      multiplier = step.multiplier;
    }
  }
  return multiplier;
}

/** Formulaic points for mental maths item complexity. */
export function scoreMentalMathsItem(content: MentalMathsItemContent): number {
  const expression = content.expression;
  let bonus = 0;
  if (/\d{3}/.test(expression)) bonus += 5;
  else if (/\d{2}/.test(expression)) bonus += 2;
  if (/\./.test(expression)) bonus += 3;
  if (/[*/]/.test(expression)) bonus += 3;
  if (/[+-].*[+-]/.test(expression.replace(/\s/g, ""))) bonus += 2;
  return 10 + bonus;
}

/** Formulaic points for numpad sequence length. */
export function scoreNumpadItem(content: NumpadSpeedItemContent): number {
  const len = content.button_sequence.length;
  if (len >= 8) return 15;
  if (len >= 5) return 12;
  return 10;
}

export function applyCorrectScore(
  basePoints: number,
  config: SkillTrainerConfigSnapshot,
  streakAfter: number,
): number {
  if (!config.streak_enabled) return basePoints;
  return basePoints * getStreakMultiplier(streakAfter, config.streak_multiplier_steps);
}

export function applyWrongScore(config: SkillTrainerConfigSnapshot): number {
  return -Math.abs(config.points_wrong);
}
