export const UCAT_SKILL_TRAINER_KEYS = [
  "find_word",
  "find_concept",
  "quick_syllogism",
  "mental_maths",
  "calculator_maths",
  "numpad_speed",
] as const;

export type UcatSkillTrainerKey = (typeof UCAT_SKILL_TRAINER_KEYS)[number];

export type UcatSkillTrainerApprovalStatus =
  | "approved"
  | "pending"
  | "rejected";

export type SkillTrainerStreakStep = {
  min_streak: number;
  multiplier: number;
};

export type SkillTrainerConfigSnapshot = {
  time_limit_seconds: number;
  points_correct: number;
  points_wrong: number;
  streak_enabled: boolean;
  streak_multiplier_steps: SkillTrainerStreakStep[];
  speed_bonus_enabled: boolean;
  speed_bonus_max_points: number;
  speed_bonus_window_seconds: number;
  trainer_key: UcatSkillTrainerKey;
};

export type FindWordKeyword = {
  id: string;
  text: string;
};

export type FindWordKeywordOccurrence = {
  keyword_id: string;
  start: number;
  end: number;
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
  premises?: string[];
  conclusion?: string;
  statement: string;
  answer: boolean;
  difficulty?: UcatSkillTrainerDifficulty;
};

export type MentalMathsItemContent = {
  expression: string;
  answer: number;
  difficulty?: UcatSkillTrainerDifficulty;
};

export type NumpadSpeedItemContent = {
  button_sequence: string[];
  label?: string;
  difficulty?: UcatSkillTrainerDifficulty;
};

export const UCAT_CALCULATOR_MATHS_CATEGORIES = [
  "arithmetic",
  "percentages",
  "probability",
  "averages",
  "algebra",
  "basic_stats",
  "decimals",
  "fractions",
  "unit_conversions",
  "geometry",
  "graphs_tables",
  "proportion_ratios",
  "speed_distance_time",
  "financial_maths",
] as const;

export type UcatCalculatorMathsCategory =
  (typeof UCAT_CALCULATOR_MATHS_CATEGORIES)[number];

export type UcatSkillTrainerDifficulty = "easy" | "medium" | "hard";

export type CalculatorMathsItemContent = {
  /** Plain-text fallback when `question` is not set */
  expression?: string;
  /** Rich-text question body (TipTap JSON) */
  question?: Record<string, unknown>;
  answer: number;
  /** Broad QR-style concept bucket for later learning-module filtering. */
  category?: UcatCalculatorMathsCategory;
  difficulty?: UcatSkillTrainerDifficulty;
};

export type SkillTrainerItemContent =
  | FindWordItemContent
  | FindConceptItemContent
  | QuickSyllogismItemContent
  | MentalMathsItemContent
  | NumpadSpeedItemContent
  | CalculatorMathsItemContent;

export type SkillTrainerAttemptProgress =
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
    };

export function isUcatSkillTrainerKey(
  value: string,
): value is UcatSkillTrainerKey {
  return (UCAT_SKILL_TRAINER_KEYS as readonly string[]).includes(value);
}

/** URL slug (kebab-case) for a trainer key. */
export function trainerKeyToSlug(key: UcatSkillTrainerKey): string {
  return key.replace(/_/g, "-");
}

/** Resolve a URL slug to a trainer key, or null if invalid. */
export function trainerSlugToKey(slug: string): UcatSkillTrainerKey | null {
  const key = slug.replace(/-/g, "_");
  return isUcatSkillTrainerKey(key) ? key : null;
}

export function isUcatSkillTrainerSlug(slug: string): boolean {
  return trainerSlugToKey(slug) !== null;
}

export function extractSkillTrainerPlainText(
  doc: Record<string, unknown> | null | undefined,
  options: { blockSeparator?: string } = {},
): string {
  if (!doc || typeof doc !== "object") return "";
  const blockSeparator = options.blockSeparator ?? "";
  const parts: string[] = [];

  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === "text" && typeof n.text === "string") {
      parts.push(n.text);
      return;
    }

    const before = parts.length;
    if (Array.isArray(n.content)) n.content.forEach(walk);
    const addedText = parts.length > before;
    if (
      addedText &&
      blockSeparator &&
      ["paragraph", "heading"].includes(n.type ?? "")
    ) {
      parts.push(blockSeparator);
    }
  };

  walk(doc);
  let text = parts.join("");
  if (blockSeparator) {
    const escapedSeparator = blockSeparator.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );
    text = text.replace(new RegExp(`${escapedSeparator}+$`), "");
  }
  return text;
}

export function findFindWordKeywordOccurrences(
  plainText: string,
  keyword: Pick<FindWordKeyword, "id" | "text">,
): FindWordKeywordOccurrence[] {
  const needle = keyword.text.trim();
  if (!needle) return [];
  const haystack = plainText.toLocaleLowerCase();
  const lowerNeedle = needle.toLocaleLowerCase();
  const occurrences: FindWordKeywordOccurrence[] = [];
  let cursor = 0;

  while (cursor <= haystack.length - lowerNeedle.length) {
    const index = haystack.indexOf(lowerNeedle, cursor);
    if (index === -1) break;
    occurrences.push({
      keyword_id: keyword.id,
      start: index,
      end: index + lowerNeedle.length,
    });
    cursor = index + Math.max(1, lowerNeedle.length);
  }

  return occurrences;
}

export function findFindWordOccurrencesForContent(
  content: FindWordItemContent,
  options: { blockSeparator?: string } = { blockSeparator: "\n" },
): FindWordKeywordOccurrence[] {
  const plain = extractSkillTrainerPlainText(content.passage, options);
  return (content.keywords ?? []).flatMap((keyword) =>
    findFindWordKeywordOccurrences(plain, keyword),
  );
}
