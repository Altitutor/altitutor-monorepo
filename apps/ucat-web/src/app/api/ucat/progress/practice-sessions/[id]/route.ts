import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { resolveQuestionAttemptScoreAndResult } from "@/features/progress/lib/build-question-attempt-row";
import { fetchSyllogismOptionsByQuestionId } from "@/features/progress/lib/syllogism-attempt-scoring";
import {
  fetchAttemptReviewCategoryDescriptions,
  fetchAttemptReviewQuestionMetadata,
  type AttemptReviewQuestionTag,
} from "@/features/progress/lib/attempt-review-question-metadata";
import type { AttemptRecentPerformance } from "@/features/progress/lib/attempt-insights";
import { fetchRecentAttemptPerformance } from "@/features/progress/server/attempt-insight-trend-service";
import { parseBinaryPlacementResponseSnapshot } from "@/features/question-engine/lib/response-state";

export type PracticeAttemptDetailResponse = {
  id: string;
  sectionName: string | null;
  sectionKey: string;
  scorePoints: number | null;
  totalPoints: number | null;
  questionCount: number | null;
  attemptedAt: string;
  completedAt: string | null;
  stemsSnapshot: unknown;
  recentPerformance: AttemptRecentPerformance;
  questionAttempts: {
    questionNumber: number;
    questionId: string;
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
    result: "correct" | "partial" | "incorrect" | "not_attempted";
    categoryName: string | null;
    categoryDescription: string | null;
    questionStemCategoryId: string | null;
    questionAnswerOptionId: string | null;
    answerSnapshot: Record<string, boolean> | null;
  }[];
};

type StemWithQuestions = {
  id: string;
  questions?: Array<{ id: string; index: number }>;
};

function getOrderedQuestionIds(
  stems: StemWithQuestions[],
): { questionId: string; stemId: string }[] {
  const result: { questionId: string; stemId: string }[] = [];
  for (const stem of stems) {
    const questions = stem.questions ?? [];
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      result.push({ questionId: q.id, stemId: stem.id });
    }
  }
  return result;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await getSupabaseServerClient();
  const sessionId = params.id;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    captureApiError(authError, "/api/ucat/progress/practice-sessions/[id]");
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: session, error: sessionError } = await (
    supabase as { from: (t: string) => ReturnType<typeof supabase.from> }
  )
    .from("vstudent_ucat_my_practice_sessions")
    .select(
      "id, ucat_section_id, section_name, section_key, score_points, total_points, question_count, started_at, completed_at, stems_snapshot",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (sessionError) {
    captureApiError(sessionError, "/api/ucat/progress/practice-sessions/[id]");
    return NextResponse.json({ error: sessionError.message }, { status: 500 });
  }

  if (!session) {
    return NextResponse.json(
      { error: "Practice session not found" },
      { status: 404 },
    );
  }

  type SessionRaw = {
    id?: string | null;
    section_name?: string | null;
    section_key?: string | null;
    score_points?: number | null;
    total_points?: number | null;
    question_count?: number | null;
    started_at?: string | null;
    completed_at?: string | null;
    stems_snapshot?: unknown;
    ucat_section_id?: string | null;
  };
  const s = session as SessionRaw;
  const stemsSnapshot = s.stems_snapshot ?? [];
  const stems = Array.isArray(stemsSnapshot) ? stemsSnapshot : [];
  const orderedQuestions = getOrderedQuestionIds(stems as StemWithQuestions[]);

  const stemIds = orderedQuestions.map((q) => q.stemId);
  const questionIds = orderedQuestions.map((q) => q.questionId);
  const [questionAttemptsResult, syllogismOptionsByQuestionId, questionMetadata] =
    await Promise.all([
      supabase
        .from("vstudent_ucat_my_question_attempts")
        .select(
          "question_id, score, time_spent_seconds, time_burden_seconds, question_type, category_name, question_stem_category_id, question_answer_option_id, answer_snapshot, is_flagged",
        )
        .eq("student_practice_session_id", sessionId)
        .eq("is_submitted", true),
      fetchSyllogismOptionsByQuestionId(supabase, stemIds),
      fetchAttemptReviewQuestionMetadata(supabase, questionIds),
    ]);

  const { data: questionAttemptsRaw, error: qaError } = questionAttemptsResult;

  if (qaError) {
    captureApiError(qaError, "/api/ucat/progress/practice-sessions/[id]");
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
        answerSnapshot:
          qa.question_type === "syllogism" && qa.question_id
            ? parseBinaryPlacementResponseSnapshot(
                qa.answer_snapshot,
                qa.question_id,
              )
            : null,
        isFlagged: qa.is_flagged ?? false,
      },
    ]),
  );

  const categoryDescriptions = await fetchAttemptReviewCategoryDescriptions(
    supabase,
    (questionAttemptsRaw ?? [])
      .map((qa) => qa.question_stem_category_id)
      .filter((id): id is string => !!id),
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
        categoryName: attemptData?.categoryName ?? null,
        categoryDescription: attemptData?.questionStemCategoryId
          ? (categoryDescriptions.get(attemptData.questionStemCategoryId) ??
            null)
          : null,
        questionStemCategoryId: attemptData?.questionStemCategoryId ?? null,
        questionAnswerOptionId: attemptData?.questionAnswerOptionId ?? null,
        answerSnapshot: attemptData?.answerSnapshot ?? null,
      };
    },
  );

  const recentPerformance = await fetchRecentAttemptPerformance(supabase, {
    source: "practice",
    attemptId: sessionId,
    attemptedAt: s.started_at ?? "",
    sectionId: s.ucat_section_id ?? null,
  });

  const response: PracticeAttemptDetailResponse = {
    id: s.id ?? "",
    sectionName: s.section_name ?? null,
    sectionKey: s.section_key ?? "",
    scorePoints: s.score_points ?? null,
    totalPoints: s.total_points ?? null,
    questionCount: s.question_count ?? null,
    attemptedAt: s.started_at ?? "",
    completedAt: s.completed_at ?? null,
    stemsSnapshot,
    recentPerformance,
    questionAttempts,
  };

  return NextResponse.json(response);
}
