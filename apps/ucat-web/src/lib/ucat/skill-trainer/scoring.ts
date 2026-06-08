import type {
  MentalMathsItemContent,
  NumpadSpeedItemContent,
  SkillTrainerConfigSnapshot,
} from "@altitutor/shared";

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
