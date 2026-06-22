import type { SupabaseClient } from "@supabase/supabase-js";

export type SyllogismOption = {
  id: string;
  index: number;
  isAnswer: boolean;
};

type StemDetailQuestion = {
  id: string;
  question_type?: string;
  answer_options?: Array<{
    id: string;
    index: number;
    is_answer?: boolean;
  }>;
};

export function computeSyllogismScore(
  snapshot: Record<string, boolean>,
  options: SyllogismOption[],
): number {
  const optionsSorted = [...options].sort((a, b) => a.index - b.index);
  let correctCount = 0;

  for (const opt of optionsSorted) {
    const student = snapshot[opt.id];
    const correctYes = opt.isAnswer === true;
    if (student === undefined) continue;
    if (student === correctYes) correctCount += 1;
  }

  if (correctCount >= 5) return 2;
  if (correctCount >= 3) return 1;
  return 0;
}

export function parseSyllogismOptionsFromStemDetails(
  stemDetails: Array<{ questions?: unknown }>,
): Map<string, SyllogismOption[]> {
  const map = new Map<string, SyllogismOption[]>();

  for (const stem of stemDetails) {
    const questions = (stem.questions ?? []) as StemDetailQuestion[];
    for (const q of questions) {
      if (q.question_type !== "syllogism") continue;
      map.set(
        q.id,
        (q.answer_options ?? []).map((o) => ({
          id: o.id,
          index: o.index,
          isAnswer: o.is_answer === true,
        })),
      );
    }
  }

  return map;
}

export async function fetchSyllogismOptionsByQuestionId(
  supabase: SupabaseClient,
  stemIds: string[],
): Promise<Map<string, SyllogismOption[]>> {
  const uniqueStemIds = [...new Set(stemIds.filter(Boolean))];
  if (uniqueStemIds.length === 0) return new Map();

  const { data, error } = await supabase
    .from("vstudent_ucat_question_stem_detail")
    .select("id, questions")
    .in("id", uniqueStemIds);

  if (error || !data) return new Map();
  return parseSyllogismOptionsFromStemDetails(data);
}

export function resolveAttemptScore(params: {
  dbScore: number | null;
  questionType: "multiple_choice" | "syllogism" | null | undefined;
  answerSnapshot: Record<string, boolean> | null | undefined;
  syllogismOptions?: SyllogismOption[];
}): number | null {
  const { dbScore, questionType, answerSnapshot, syllogismOptions } = params;

  if (
    questionType === "syllogism" &&
    answerSnapshot &&
    syllogismOptions &&
    syllogismOptions.length > 0
  ) {
    return computeSyllogismScore(answerSnapshot, syllogismOptions);
  }

  return dbScore;
}
