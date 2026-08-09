import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";
import { resolveQuestionAttemptScoreAndResult } from "@/features/progress/lib/build-question-attempt-row";
import {
  fetchAttemptReviewQuestionMetadata,
  type AttemptReviewQuestionTag,
} from "@/features/progress/lib/attempt-review-question-metadata";
import type { QuestionEngineExam } from "@/features/question-engine/model/types";
import {
  buildAttemptReviewExam,
  parseAttemptContentSnapshot,
  snapshotQuestionMetadata,
  snapshotToQuestionItem,
} from "@/features/progress/lib/attempt-content-snapshot";
import { getAttemptPercentile } from "@/features/progress/server/attempt-percentile-service";
import type { CohortPercentileResult } from "@altitutor/ucat-percentiles";
import type { AttemptRecentPerformance } from "@/features/progress/lib/attempt-insights";
import { fetchRecentAttemptPerformance } from "@/features/progress/server/attempt-insight-trend-service";
import { getQuestionMaximumMarks, parseBinaryPlacementResponseSnapshot } from "@/features/question-engine/lib/response-state";

export type SetAttemptDetailResponse = {
  id: string;
  questionSetId: string;
  questionSetName: string | null;
  scorePoints: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
  percentile: CohortPercentileResult;
  recentPerformance: AttemptRecentPerformance;
  timeTakenSeconds: number | null;
  setTimeLimitSeconds: number | null;
  examTimeLimitSeconds: number | null;
  studentSetSpeed: number | null;
  studentExamSpeed: number | null;
  attemptedAt: string;
  completedAt: string | null;
  exam: QuestionEngineExam;
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
    captureApiError(authError, "/api/ucat/progress/set-attempts/[id]");
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: attempt, error: attemptError } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select(
      "id, attempted_at, completed_at, question_set_id, score_points, total_points, scaled_score, time_taken_seconds, set_time_limit_seconds, set_time_limit_at_exam_speed_seconds, student_set_speed, student_exam_speed, content_snapshot",
    )
    .eq("id", attemptId)
    .maybeSingle();

  if (attemptError) {
    captureApiError(attemptError, "/api/ucat/progress/set-attempts/[id]");
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

  const setSnapshot = (attempt.content_snapshot ?? {}) as {
    name?: unknown;
    stemIds?: string[];
  };
  const questionSetName = setSnapshot.name != null
    ? extractTextFromRichJson(setSnapshot.name as JsonLike) || null
    : null;
  const stemOrder = new Map(
    (Array.isArray(setSnapshot.stemIds) ? setSnapshot.stemIds : []).map(
      (stemId, index) => [stemId, index],
    ),
  );

  const questionAttemptsResult = await
      supabase
        .from("vstudent_ucat_my_question_attempts")
        .select(
          "question_id, score, time_spent_seconds, time_burden_seconds, question_type, category_name, question_stem_category_id, question_answer_option_id, answer_snapshot, is_flagged, attempted_at, content_snapshot",
        )
        .eq("student_question_set_attempt_id", attemptId)
        .eq("is_submitted", true);

  const { data: questionAttemptsRaw, error: qaError } = questionAttemptsResult;

  if (qaError) {
    captureApiError(qaError, "/api/ucat/progress/set-attempts/[id]");
    return NextResponse.json({ error: qaError.message }, { status: 500 });
  }

  const orderedAttempts = (questionAttemptsRaw ?? [])
    .map((row) => ({ row, snapshot: parseAttemptContentSnapshot(row.content_snapshot) }))
    .filter((entry): entry is typeof entry & { snapshot: NonNullable<typeof entry.snapshot> } => Boolean(entry.snapshot))
    .sort((a, b) =>
      (stemOrder.get(a.snapshot.stem.id) ?? Number.MAX_SAFE_INTEGER) -
        (stemOrder.get(b.snapshot.stem.id) ?? Number.MAX_SAFE_INTEGER) ||
      a.snapshot.question.index - b.snapshot.question.index ||
      (a.row.attempted_at ?? "").localeCompare(b.row.attempted_at ?? ""),
    );
  const questionIds = orderedAttempts.map(({ snapshot }) => snapshot.question.id);
  const questionMetadata = await fetchAttemptReviewQuestionMetadata(supabase, questionIds);
  const attemptsByQuestionId = new Map(
    (questionAttemptsRaw ?? []).map((qa) => {
      const snapshot = parseAttemptContentSnapshot(qa.content_snapshot);
      return [
      snapshot?.question.id ?? qa.question_id,
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
        snapshot,
      },
    ] as const
    }),
  );

  let currentStemId: string | null = null;
  let stemIndex = 0;
  const questionAttempts = orderedAttempts.map(
    ({ snapshot }, index) => {
      const questionId = snapshot.question.id;
      const stemId = snapshot.stem.id;
      if (stemId !== currentStemId) {
        currentStemId = stemId;
        stemIndex += 1;
      }
      const attemptData = attemptsByQuestionId.get(questionId);
      const snapshotMetadata = snapshotQuestionMetadata(snapshot);
      const questionNumber = index + 1;
      const { score, result } = resolveQuestionAttemptScoreAndResult({
        attemptData,
        maximumPoints: getQuestionMaximumMarks(
          snapshotToQuestionItem(snapshot, index, attempt.question_set_id ?? "review"),
        ),
      });
      const timeSpentSeconds = attemptData?.timeSpentSeconds ?? null;
      const metadata = questionMetadata.get(questionId);
      const timeBurdenSeconds =
        attemptData?.timeBurdenSeconds ?? snapshotMetadata.timeBurdenSeconds ?? metadata?.timeBurdenSeconds ?? null;
      const questionType = attemptData?.questionType ?? snapshot.question.questionType;

      const categoryName =
        attemptData?.categoryName ?? snapshotMetadata.categoryName;
      const questionStemCategoryId =
        attemptData?.questionStemCategoryId ?? snapshotMetadata.questionStemCategoryId;
      const categoryDescription = snapshotMetadata.categoryDescription;

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
        difficulty: snapshotMetadata.difficulty ?? metadata?.difficulty ?? null,
        questionTags: snapshotMetadata.questionTags.length > 0 ? snapshotMetadata.questionTags : (metadata?.questionTags ?? []),
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

  const timeTakenSeconds = attempt.time_taken_seconds ?? null;
  const setTimeLimitSeconds = attempt.set_time_limit_seconds ?? null;
  const timeLimitExamSeconds =
    attempt.set_time_limit_at_exam_speed_seconds ?? null;

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

  const [percentile, recentPerformance] = await Promise.all([
    getAttemptPercentile("set", attemptId),
    fetchRecentAttemptPerformance(supabase, {
      source: "set",
      attemptId,
      attemptedAt: attempt.attempted_at ?? "",
    }),
  ]);

  const response: SetAttemptDetailResponse = {
    id: attempt.id ?? "",
    questionSetId,
    questionSetName,
    scorePoints: attempt.score_points,
    totalPoints: attempt.total_points,
    scaledScore: attempt.scaled_score,
    percentile,
    recentPerformance,
    timeTakenSeconds,
    setTimeLimitSeconds,
    examTimeLimitSeconds: timeLimitExamSeconds,
    studentSetSpeed,
    studentExamSpeed,
    attemptedAt: attempt.attempted_at ?? "",
    completedAt: attempt.completed_at,
    exam: buildAttemptReviewExam({
      sourceType: "set",
      sourceId: questionSetId,
      title: questionSetName ?? "Set attempt",
      snapshots: orderedAttempts.map(({ snapshot }) => ({ snapshot, questionSetId })),
    }),
    questionAttempts,
  };

  return NextResponse.json(response);
}
