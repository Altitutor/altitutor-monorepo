export const UCAT_SKILL_TRAINER_KEYS = [
  "find_word",
  "find_concept",
  "quick_syllogism",
  "mental_maths",
  "numpad_speed",
  "calculator_maths",
] as const;

export type UcatSkillTrainerKey = (typeof UCAT_SKILL_TRAINER_KEYS)[number];

export type UcatSkillTrainerApprovalStatus = "approved" | "pending" | "rejected";

export type SkillTrainerStreakStep = {
  min_streak: number;
  multiplier: number;
};

export type SkillTrainerConfigSnapshot = {
  time_limit_seconds: number;
  wrong_cooldown_seconds: number;
  points_correct: number;
  points_wrong: number;
  streak_enabled: boolean;
  streak_multiplier_steps: SkillTrainerStreakStep[];
  trainer_key: UcatSkillTrainerKey;
};

export type FindWordKeyword = {
  id: string;
  text: string;
  target_sentence_index: number;
};

export type FindWordItemContent = {
  passage: Record<string, unknown>;
  keywords: FindWordKeyword[];
};

export type FindConceptOccurrence = {
  start: number;
  end: number;
};

export type FindConceptItemContent = {
  passage: Record<string, unknown>;
  concept: string;
  occurrences: FindConceptOccurrence[];
};

export type QuickSyllogismItemContent = {
  statement: string;
  answer: boolean;
};

export type MentalMathsItemContent = {
  expression: string;
  answer: number;
};

export type NumpadSpeedItemContent = {
  button_sequence: string[];
  label?: string;
};

export type CalculatorMathsItemContent = {
  expression: string;
  answer: number;
};

export type SkillTrainerItemContent =
  | FindWordItemContent
  | FindConceptItemContent
  | QuickSyllogismItemContent
  | MentalMathsItemContent
  | NumpadSpeedItemContent
  | CalculatorMathsItemContent;

export type SkillTrainerAttemptProgress = {
  cooldown_until?: string | null;
} & (
  | {
      type: "find_word";
      placed_keyword_ids: string[];
    }
  | {
      type: "find_concept";
      found_occurrence_indexes: number[];
    }
  | {
      type: "quick_syllogism";
    }
  | {
      type: "mental_maths";
    }
  | {
      type: "numpad_speed";
    }
  | {
      type: "calculator_maths";
    }
);

export function isUcatSkillTrainerKey(value: string): value is UcatSkillTrainerKey {
  return (UCAT_SKILL_TRAINER_KEYS as readonly string[]).includes(value);
}
