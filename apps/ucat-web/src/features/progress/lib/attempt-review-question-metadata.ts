import { supabaseAdmin } from "@/lib/supabase/admin";
import type { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

export type AttemptReviewQuestionTag = {
  name: string;
  description: string | null;
};

export type AttemptReviewQuestionMetadata = {
  difficulty: number | null;
  timeBurdenSeconds: number | null;
  averageTimeSeconds: number | null;
  averageTimeSampleSize: number;
  questionTags: AttemptReviewQuestionTag[];
};

export type AttemptReviewStemCategory = {
  categoryId: string;
  categoryName: string;
};

const EMPTY_METADATA: AttemptReviewQuestionMetadata = {
  difficulty: null,
  timeBurdenSeconds: null,
  averageTimeSeconds: null,
  averageTimeSampleSize: 0,
  questionTags: [],
};

const MIN_AVERAGE_TIME_SAMPLE_SIZE = 5;

function descriptionToText(description: unknown): string | null {
  if (description == null) return null;
  if (typeof description === "string") {
    const trimmed = description.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  const extracted = extractTextFromRichJson(description as JsonLike).trim();
  return extracted.length > 0 ? extracted : null;
}

export async function fetchAttemptReviewQuestionMetadata(
  supabase: SupabaseServerClient,
  questionIds: string[],
): Promise<Map<string, AttemptReviewQuestionMetadata>> {
  const ids = [...new Set(questionIds.filter(Boolean))];
  const result = new Map<string, AttemptReviewQuestionMetadata>();
  for (const id of ids) result.set(id, { ...EMPTY_METADATA });
  if (ids.length === 0) return result;

  const questionRowsPromise = supabase
    .from("ucat_questions")
    .select("id, difficulty, time_burden_seconds")
    .in("id", ids);

  const tagRowsPromise = (
    supabase as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          in: (
            column: string,
            values: string[],
          ) => Promise<{
            data: Array<{
              question_id?: string | null;
              question_tags?: {
                name?: string | null;
                description?: unknown;
              } | null;
            }> | null;
          }>;
        };
      };
    }
  )
    .from("questions_question_tags")
    .select("question_id, question_tags(name, description)")
    .in("question_id", ids);

  const timingRowsPromise = supabaseAdmin
    ? supabaseAdmin
        .from("student_question_attempts")
        .select("question_id, time_spent_seconds")
        .in("question_id", ids)
        .eq("is_submitted", true)
        .not("time_spent_seconds", "is", null)
    : Promise.resolve({ data: [] });

  const [questionResult, tagResult, timingResult] = await Promise.all([
    questionRowsPromise,
    tagRowsPromise,
    timingRowsPromise,
  ]);

  const questionRows = questionResult.data;

  for (const row of questionRows ?? []) {
    if (!row.id) continue;
    const current = result.get(row.id) ?? { ...EMPTY_METADATA };
    result.set(row.id, {
      ...current,
      difficulty: row.difficulty ?? null,
      timeBurdenSeconds: row.time_burden_seconds ?? null,
    });
  }

  const tagRows = tagResult.data;

  for (const row of tagRows ?? []) {
    if (!row.question_id || !row.question_tags?.name) continue;
    const current = result.get(row.question_id) ?? { ...EMPTY_METADATA };
    result.set(row.question_id, {
      ...current,
      questionTags: [
        ...current.questionTags,
        {
          name: row.question_tags.name,
          description: descriptionToText(row.question_tags.description),
        },
      ],
    });
  }

  const timingRows = timingResult.data;

  const timingByQuestion = new Map<string, { sum: number; count: number }>();
  for (const row of timingRows ?? []) {
    if (!row.question_id || row.time_spent_seconds == null) continue;
    const current = timingByQuestion.get(row.question_id) ?? {
      sum: 0,
      count: 0,
    };
    current.sum += row.time_spent_seconds;
    current.count += 1;
    timingByQuestion.set(row.question_id, current);
  }

  for (const [questionId, timing] of timingByQuestion.entries()) {
    const current = result.get(questionId) ?? { ...EMPTY_METADATA };
    result.set(questionId, {
      ...current,
      averageTimeSeconds:
        timing.count >= MIN_AVERAGE_TIME_SAMPLE_SIZE
          ? timing.sum / timing.count
          : null,
      averageTimeSampleSize: timing.count,
    });
  }

  return result;
}

export async function fetchAttemptReviewStemCategories(
  supabase: SupabaseServerClient,
  stemIds: string[],
): Promise<Map<string, AttemptReviewStemCategory>> {
  const ids = [...new Set(stemIds.filter(Boolean))];
  const result = new Map<string, AttemptReviewStemCategory>();
  if (ids.length === 0) return result;

  const { data: stemRows } = await supabase
    .from("vstudent_ucat_question_stems")
    .select("id, question_stem_category_id")
    .in("id", ids);

  const categoryIds = [
    ...new Set(
      (stemRows ?? [])
        .map((row) => row.question_stem_category_id)
        .filter((id): id is string => !!id),
    ),
  ];
  if (categoryIds.length === 0) return result;

  const { data: categoryRows } = await supabase
    .from("vstudent_ucat_question_stem_categories")
    .select("id, name")
    .in("id", categoryIds);
  const categoryNames = new Map(
    (categoryRows ?? []).map((row) => [row.id, row.name ?? "Unknown"]),
  );

  for (const row of stemRows ?? []) {
    if (!row.id || !row.question_stem_category_id) continue;
    result.set(row.id, {
      categoryId: row.question_stem_category_id,
      categoryName:
        categoryNames.get(row.question_stem_category_id) ?? "Unknown",
    });
  }

  return result;
}

export async function fetchAttemptReviewCategoryDescriptions(
  supabase: SupabaseServerClient,
  categoryIds: string[],
): Promise<Map<string, string | null>> {
  const ids = [...new Set(categoryIds.filter(Boolean))];
  const result = new Map<string, string | null>();
  for (const id of ids) result.set(id, null);
  if (ids.length === 0) return result;

  const client = supabaseAdmin ?? supabase;
  const { data } = await (
    client as unknown as {
      from: (table: string) => {
        select: (columns: string) => {
          in: (
            column: string,
            values: string[],
          ) => Promise<{
            data: Array<{
              id?: string | null;
              description?: unknown;
            }> | null;
          }>;
        };
      };
    }
  )
    .from("question_stem_categories")
    .select("id, description")
    .in("id", ids);

  for (const row of data ?? []) {
    if (!row.id) continue;
    result.set(row.id, descriptionToText(row.description));
  }

  return result;
}
