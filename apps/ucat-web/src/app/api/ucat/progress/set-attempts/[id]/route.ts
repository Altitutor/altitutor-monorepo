import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";
import { resolveQuestionAttemptScoreAndResult } from "@/features/progress/lib/build-question-attempt-row";
import { fetchSyllogismOptionsByQuestionId } from "@/features/progress/lib/syllogism-attempt-scoring";
import {
  fetchAttemptReviewCategoryDescriptions,
  fetchAttemptReviewQuestionMetadata,
  fetchAttemptReviewStemCategories,
  type AttemptReviewQuestionTag,
} from "@/features/progress/lib/attempt-review-question-metadata";

export type SetAttemptDetailResponse = {
  id: string;
  questionSetId: string;
  questionSetName: string | null;
  scorePoints: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
  timeTakenSeconds: number | null;
  setTimeLimitSeconds: number | null;
  examTimeLimitSeconds: number | null;
  studentSetSpeed: number | null;
  studentExamSpeed: number | null;
  attemptedAt: string;
  completedAt: string | null;
  questionAttempts: {
    questionNumber: number;
    questionId: string;
    /** 1-based stem index within the set */
    stemIndex: number;
    score: number | null;
    timeSpentSeconds: number | null;
    averageTimeSeconds: number | null;
    averageTimeSampleSize: number;
    timeBurdenSeconds: number | null;
    difficulty: number | null;
    questionTags: AttemptReviewQuestionTag[];
    isFlagged: boolean;
    questionType: "multiple_choice" | "syllogism" | null;
    /** 'correct' | 'partial' | 'incorrect' | 'not_attempted' */
    result: "correct" | "partial" | "incorrect" | "not_attempted";
    categoryName: string | null;
    categoryDescription: string | null;
    questionStemCategoryId: string | null;
    /** For answers view: selected option id (multiple choice) or null */
    questionAnswerOptionId: string | null;
    /** For answers view: syllogism snapshot { optionId: boolean } */
    answerSnapshot: Record<string, boolean> | null;
  }[];
};

type StemWithQuestions = {
  stem_id: string;
  stem_text?: string;
  questions_meta?: Array<{ id: string; index: number }>;
};

function parseAnswerSnapshot(
  snapshot: unknown,
): Record<string, boolean> | null {
  if (!snapshot || typeof snapshot !== "object") return null;
  const obj = snapshot as Record<string, unknown>;
  if (obj.type !== "syllogism_v1" || !Array.isArray(obj.answers)) return null;
  const answers = obj.answers as Array<{
    question_answer_option_id: string;
    answer: boolean;
  }>;
  const result: Record<string, boolean> = {};
  for (const a of answers) {
    result[a.question_answer_option_id] = a.answer;
  }
  return result;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await getSupabaseServerClient();
  const attemptId = params.id;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select(
      "id, attempted_at, completed_at, question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds, student_set_speed, student_exam_speed",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    return NextResponse.json({ error: attemptError.message }, { status: 500 });
  }

  if (!attempt) {
    return NextResponse.json(
      { error: "Set attempt not found" },
      { status: 404 },
    );
  }

  const questionSetId = attempt.question_set_id;
  if (!questionSetId) {
    return NextResponse.json(
      { error: "Set attempt has no question set" },
      { status: 400 },
    );
  }

  const { data: setDetail, error: setError } = await supabase
    .from("vstudent_ucat_question_set_detail")
    .select("id, name, stems")
    .eq("id", questionSetId)
    .maybeSingle();

  if (setError) {
    return NextResponse.json({ error: setError.message }, { status: 500 });
  }

  const { data: setTiming } = await supabase
    .from("vstudent_ucat_question_sets")
    .select("time_limit_seconds, time_limit_at_exam_speed_seconds")
    .eq("id", questionSetId)
    .maybeSingle();

  const stems = (setDetail?.stems ?? []) as StemWithQuestions[];
  const stemIds = stems.map((s) => s.stem_id).filter(Boolean);
  const orderedQuestions: { questionId: string; stemId: string }[] = [];
  for (const stem of stems) {
    const questions = stem.questions_meta ?? [];
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      orderedQuestions.push({ questionId: q.id, stemId: stem.stem_id });
    }
  }

  const questionIds = orderedQuestions.map((q) => q.questionId);
  const [
    questionAttemptsResult,
    stemCategoryMap,
    questionMetadata,
    syllogismOptionsByQuestionId,
  ] = await Promise.all([
      supabase
        .from("vstudent_ucat_my_question_attempts")
        .select(
          "question_id, score, time_spent_seconds, time_burden_seconds, question_type, category_name, question_stem_category_id, question_answer_option_id, answer_snapshot, is_flagged",
        )
        .eq("student_question_set_attempt_id", attemptId)
        .eq("is_submitted", true),
      fetchAttemptReviewStemCategories(supabase, stemIds),
      fetchAttemptReviewQuestionMetadata(supabase, questionIds),
      fetchSyllogismOptionsByQuestionId(supabase, stemIds),
    ]);

  const { data: questionAttemptsRaw, error: qaError } = questionAttemptsResult;

  if (qaError) {
    return NextResponse.json({ error: qaError.message }, { status: 500 });
  }

  const attemptsByQuestionId = new Map(
    (questionAttemptsRaw ?? []).map((qa) => [
      qa.question_id,
      {
        score: qa.score,
        timeSpentSeconds: qa.time_spent_seconds,
        timeBurdenSeconds: qa.time_burden_seconds,
        questionType: qa.question_type as
          | "multiple_choice"
          | "syllogism"
          | null,
        categoryName: qa.category_name,
        questionStemCategoryId: qa.question_stem_category_id,
        questionAnswerOptionId: qa.question_answer_option_id ?? null,
        answerSnapshot: parseAnswerSnapshot(qa.answer_snapshot),
        isFlagged: qa.is_flagged ?? false,
      },
    ]),
  );

  const categoryDescriptions = await fetchAttemptReviewCategoryDescriptions(
    supabase,
    [
      ...Array.from(stemCategoryMap.values()).map(
        (category) => category.categoryId,
      ),
      ...(questionAttemptsRaw ?? [])
        .map((qa) => qa.question_stem_category_id)
        .filter((id): id is string => !!id),
    ],
  );

  let currentStemId: string | null = null;
  let stemIndex = 0;
  const questionAttempts = orderedQuestions.map(
    ({ questionId, stemId }, index) => {
      if (stemId !== currentStemId) {
        currentStemId = stemId;
        stemIndex += 1;
      }
      const attemptData = attemptsByQuestionId.get(questionId);
      const stemCategory = stemCategoryMap.get(stemId);
      const questionNumber = index + 1;
      const { score, result } = resolveQuestionAttemptScoreAndResult({
        questionId,
        attemptData,
        syllogismOptionsByQuestionId,
      });
      const timeSpentSeconds = attemptData?.timeSpentSeconds ?? null;
      const metadata = questionMetadata.get(questionId);
      const timeBurdenSeconds =
        attemptData?.timeBurdenSeconds ?? metadata?.timeBurdenSeconds ?? null;
      const questionType = attemptData?.questionType ?? null;

      const categoryName =
        attemptData?.categoryName ?? stemCategory?.categoryName ?? null;
      const questionStemCategoryId =
        attemptData?.questionStemCategoryId ?? stemCategory?.categoryId ?? null;
      const categoryDescription = questionStemCategoryId
        ? (categoryDescriptions.get(questionStemCategoryId) ?? null)
        : null;

      const questionAnswerOptionId =
        attemptData?.questionAnswerOptionId ?? null;
      const answerSnapshot = attemptData?.answerSnapshot ?? null;

      return {
        questionNumber,
        questionId,
        stemIndex,
        score,
        timeSpentSeconds,
        averageTimeSeconds: metadata?.averageTimeSeconds ?? null,
        averageTimeSampleSize: metadata?.averageTimeSampleSize ?? 0,
        timeBurdenSeconds,
        difficulty: metadata?.difficulty ?? null,
        questionTags: metadata?.questionTags ?? [],
        isFlagged: attemptData?.isFlagged ?? false,
        questionType,
        result,
        categoryName,
        categoryDescription,
        questionStemCategoryId,
        questionAnswerOptionId,
        answerSnapshot,
      };
    },
  );

  const questionSetName =
    setDetail?.name != null
      ? extractTextFromRichJson(setDetail.name as JsonLike) || null
      : null;

  const timeTakenSeconds = attempt.time_taken_seconds ?? null;
  let setTimeLimitSeconds = attempt.set_time_limit_seconds ?? null;
  let timeLimitExamSeconds =
    attempt.set_time_limit_at_exam_speed_seconds ?? null;

  if (setTimeLimitSeconds == null) {
    setTimeLimitSeconds = setTiming?.time_limit_seconds ?? null;
  }
  if (timeLimitExamSeconds == null) {
    timeLimitExamSeconds =
      setTiming?.time_limit_at_exam_speed_seconds ?? null;
  }

  let studentSetSpeed = attempt.student_set_speed ?? null;
  let studentExamSpeed = attempt.student_exam_speed ?? null;
  if (timeTakenSeconds != null && timeTakenSeconds > 0) {
    if (
      studentSetSpeed == null &&
      setTimeLimitSeconds != null &&
      setTimeLimitSeconds > 0
    ) {
      studentSetSpeed = setTimeLimitSeconds / timeTakenSeconds;
    }
    if (
      studentExamSpeed == null &&
      timeLimitExamSeconds != null &&
      timeLimitExamSeconds > 0
    ) {
      studentExamSpeed = timeLimitExamSeconds / timeTakenSeconds;
    }
  }

  const response: SetAttemptDetailResponse = {
    id: attempt.id ?? "",
    questionSetId,
    questionSetName,
    scorePoints: attempt.score_points,
    totalPoints: attempt.total_points,
    scaledScore: attempt.scaled_score,
    timeTakenSeconds,
    setTimeLimitSeconds,
    examTimeLimitSeconds: timeLimitExamSeconds,
    studentSetSpeed,
    studentExamSpeed,
    attemptedAt: attempt.attempted_at ?? "",
    completedAt: attempt.completed_at,
    questionAttempts,
  };

  return NextResponse.json(response);
}
