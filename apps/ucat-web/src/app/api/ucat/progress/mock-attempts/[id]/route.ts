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
import { getQuestionMaximumMarks } from "@/features/question-engine/lib/response-state";

export type MockSetInfo = {
  setAttemptId: string;
  questionSetId: string;
  questionSetName: string | null;
  scorePoints: number | null;
  totalPoints: number | null;
  scaledScore: number | null;
};

export type MockAttemptDetailResponse = {
  id: string;
  ucatMockId: string;
  mockName: string | null;
  scaledScore: number | null;
  percentile: CohortPercentileResult;
  recentPerformance: AttemptRecentPerformance;
  /** Max possible scaled score (900 × section 1–3 sets). Section 4 excluded. */
  scaledScoreMax: number | null;
  timeTakenSeconds: number | null;
  mockTimeLimitSeconds: number | null;
  examTimeLimitSeconds: number | null;
  studentMockSpeed: number | null;
  studentExamSpeed: number | null;
  attemptedAt: string;
  completedAt: string | null;
  sets: MockSetInfo[];
  questionAttempts: {
    questionNumber: number;
    questionId: string;
    setIndex: number;
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
    result: "correct" | "partial" | "incorrect" | "not_attempted";
    questionAnswerOptionId: string | null;
    answerSnapshot: unknown;
    categoryName: string | null;
    categoryDescription: string | null;
    questionStemCategoryId: string | null;
  }[];
  /** Indices (0-based) after which to draw set divider (last question index of each set except final) */
  setBoundaryIndices: number[];
  exam: QuestionEngineExam;
};

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await getSupabaseServerClient();
  const mockAttemptId = params.id;

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    captureApiError(authError, "/api/ucat/progress/mock-attempts/[id]");
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: mockAttempt, error: mockError } = await supabase
    .from("vstudent_ucat_my_mock_attempts")
    .select(
      "id, ucat_mock_id, attempted_at, completed_at, score_points, total_points, scaled_score, time_taken, mock_time_limit_seconds, mock_time_limit_at_exam_speed_seconds, student_mock_speed, content_snapshot",
    )
    .eq("id", mockAttemptId)
    .maybeSingle();

  if (mockError) {
    captureApiError(mockError, "/api/ucat/progress/mock-attempts/[id]");
    return NextResponse.json({ error: mockError.message }, { status: 500 });
  }

  if (!mockAttempt) {
    return NextResponse.json(
      { error: "Mock attempt not found" },
      { status: 404 },
    );
  }

  const ucatMockId = mockAttempt.ucat_mock_id;
  if (!ucatMockId) {
    return NextResponse.json(
      { error: "Mock attempt has no mock" },
      { status: 400 },
    );
  }

  const mockSnapshot = (mockAttempt.content_snapshot ?? {}) as {
    name?: unknown;
    setIds?: string[];
  };
  const mockSetIds = Array.isArray(mockSnapshot.setIds) ? mockSnapshot.setIds : [];

  const setAttemptsResult = await
      supabase
        .from("vstudent_ucat_my_set_attempts")
        .select("id, question_set_id, score_points, total_points, scaled_score, content_snapshot")
        .eq("student_ucat_mock_attempt_id", mockAttemptId);

  const SITUATIONAL_JUDGEMENT_SECTION = 4;

  const { data: setAttemptsRaw, error: setAttemptsError } = setAttemptsResult;

  if (setAttemptsError) {
    captureApiError(setAttemptsError, "/api/ucat/progress/mock-attempts/[id]");
    return NextResponse.json(
      { error: setAttemptsError.message },
      { status: 500 },
    );
  }

  const setAttemptsBySetId = new Map(
    (setAttemptsRaw ?? []).map((a) => [a.question_set_id, a]),
  );

  const { data: allQuestionAttempts, error: qaError } = await supabase
    .from("vstudent_ucat_my_question_attempts")
    .select(
      "question_id, score, time_spent_seconds, time_burden_seconds, question_type, student_question_set_attempt_id, question_answer_option_id, answer_snapshot, category_name, question_stem_category_id, is_flagged, attempted_at, content_snapshot",
    )
    .in(
      "student_question_set_attempt_id",
      (setAttemptsRaw ?? []).map((a) => a.id).filter(Boolean),
    )
    .eq("is_submitted", true);

  if (qaError) {
    captureApiError(qaError, "/api/ucat/progress/mock-attempts/[id]");
    return NextResponse.json({ error: qaError.message }, { status: 500 });
  }

  const attemptsBySetAndQuestion = new Map<
    string,
    {
      score: number | null;
      timeSpentSeconds: number | null;
      timeBurdenSeconds: number | null;
      questionType: "multiple_choice" | "syllogism" | null;
      questionAnswerOptionId: string | null;
      answerSnapshot: unknown;
      categoryName: string | null;
      questionStemCategoryId: string | null;
      isFlagged: boolean;
    }
  >();
  for (const qa of allQuestionAttempts ?? []) {
    const snapshot = parseAttemptContentSnapshot(qa.content_snapshot);
    const key = `${qa.student_question_set_attempt_id}:${snapshot?.question.id ?? qa.question_id}`;
    attemptsBySetAndQuestion.set(key, {
      score: qa.score,
      timeSpentSeconds: qa.time_spent_seconds,
      timeBurdenSeconds: qa.time_burden_seconds,
      questionType: qa.question_type as "multiple_choice" | "syllogism" | null,
      questionAnswerOptionId: qa.question_answer_option_id ?? null,
      answerSnapshot: qa.answer_snapshot,
      categoryName: qa.category_name ?? null,
      questionStemCategoryId: qa.question_stem_category_id ?? null,
      isFlagged: qa.is_flagged ?? false,
    });
  }

  const sets: MockSetInfo[] = [];
  const questionAttempts: MockAttemptDetailResponse["questionAttempts"] = [];
  const setBoundaryIndices: number[] = [];
  let globalQuestionNumber = 0;

  const setSnapshotByAttemptId = new Map(
    (setAttemptsRaw ?? []).map((setAttempt) => [
      setAttempt.id ?? "",
      (setAttempt.content_snapshot ?? {}) as { name?: unknown; stemIds?: string[] },
    ]),
  );
  const orderedSnapshotAttempts = (allQuestionAttempts ?? [])
    .map((row) => ({ row, snapshot: parseAttemptContentSnapshot(row.content_snapshot) }))
    .filter((entry): entry is typeof entry & { snapshot: NonNullable<typeof entry.snapshot> } => Boolean(entry.snapshot))
    .sort((a, b) => {
      const aSetAttempt = (setAttemptsRaw ?? []).find((attempt) => attempt.id === a.row.student_question_set_attempt_id);
      const bSetAttempt = (setAttemptsRaw ?? []).find((attempt) => attempt.id === b.row.student_question_set_attempt_id);
      const aSetIndex = mockSetIds.indexOf(aSetAttempt?.question_set_id ?? "");
      const bSetIndex = mockSetIds.indexOf(bSetAttempt?.question_set_id ?? "");
      const aStemIds = setSnapshotByAttemptId.get(a.row.student_question_set_attempt_id ?? "")?.stemIds ?? [];
      const bStemIds = setSnapshotByAttemptId.get(b.row.student_question_set_attempt_id ?? "")?.stemIds ?? [];
      return aSetIndex - bSetIndex ||
        aStemIds.indexOf(a.snapshot.stem.id) - bStemIds.indexOf(b.snapshot.stem.id) ||
        a.snapshot.question.index - b.snapshot.question.index ||
        (a.row.attempted_at ?? "").localeCompare(b.row.attempted_at ?? "");
    });
  const allQuestionIds = orderedSnapshotAttempts.map(({ snapshot }) => snapshot.question.id);
  const questionMetadata = await fetchAttemptReviewQuestionMetadata(supabase, allQuestionIds);

  for (let setIndex = 0; setIndex < mockSetIds.length; setIndex++) {
    const questionSetId = mockSetIds[setIndex];
    const setAttempt = setAttemptsBySetId.get(questionSetId);
    const setSnapshot = (setAttempt?.content_snapshot ?? {}) as { name?: unknown; stemIds?: string[] };

    const setAttemptId = setAttempt?.id ?? "";
    const questionSetName =
      setSnapshot.name != null
        ? extractTextFromRichJson(setSnapshot.name as JsonLike) || null
        : null;

    sets.push({
      setAttemptId,
      questionSetId,
      questionSetName,
      scorePoints: setAttempt?.score_points ?? null,
      totalPoints: setAttempt?.total_points ?? null,
      scaledScore: setAttempt?.scaled_score ?? null,
    });

    let currentStemId: string | null = null;
    let stemIndex = 0;

    const setQuestionSnapshots = orderedSnapshotAttempts.filter(
      ({ row }) => row.student_question_set_attempt_id === setAttemptId,
    );
    for (const { snapshot } of setQuestionSnapshots) {
      if (snapshot.stem.id !== currentStemId) {
        currentStemId = snapshot.stem.id;
        stemIndex += 1;
      }
        globalQuestionNumber++;
        const questionId = snapshot.question.id;
        const attemptData = setAttempt
          ? attemptsBySetAndQuestion.get(`${setAttempt.id}:${questionId}`)
          : undefined;
        const snapshotMetadata = snapshotQuestionMetadata(snapshot);

        const { score, result } = resolveQuestionAttemptScoreAndResult({
          attemptData,
          maximumPoints: getQuestionMaximumMarks(
            snapshotToQuestionItem(snapshot, globalQuestionNumber - 1, questionSetId),
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

        questionAttempts.push({
          questionNumber: globalQuestionNumber,
          questionId,
          setIndex,
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
          questionAnswerOptionId: attemptData?.questionAnswerOptionId ?? null,
          answerSnapshot: attemptData?.answerSnapshot ?? null,
          categoryName,
          categoryDescription,
          questionStemCategoryId,
        });
    }

    if (setIndex < mockSetIds.length - 1 && setQuestionSnapshots.length > 0) {
      setBoundaryIndices.push(globalQuestionNumber - 1);
    }
  }

  const mockName =
    mockSnapshot.name != null
      ? extractTextFromRichJson(mockSnapshot.name as JsonLike) || null
      : null;

  const sectionNumberBySetId = new Map<string, number>();
  for (const { row, snapshot } of orderedSnapshotAttempts) {
    const setAttempt = (setAttemptsRaw ?? []).find((attempt) => attempt.id === row.student_question_set_attempt_id);
    if (setAttempt?.question_set_id && snapshot.stem.sectionNumber != null) {
      sectionNumberBySetId.set(setAttempt.question_set_id, snapshot.stem.sectionNumber);
    }
  }
  const scoredSetCount = sets.filter((s) => {
    const sectionNum = s.questionSetId
      ? sectionNumberBySetId.get(s.questionSetId)
      : undefined;
    return sectionNum !== SITUATIONAL_JUDGEMENT_SECTION;
  }).length;
  const scaledScore = mockAttempt.scaled_score ?? (sets.length > 0
    ? sets.reduce((sum, s) => {
        const sectionNum = sectionNumberBySetId.get(s.questionSetId);
        return sectionNum === SITUATIONAL_JUDGEMENT_SECTION ? sum : sum + (s.scaledScore ?? 0);
      }, 0)
    : null);

  const scaledScoreMax = scoredSetCount > 0 ? scoredSetCount * 900 : null;

  const timeTakenSeconds = mockAttempt.time_taken ?? null;
  const mockTimeLimitSeconds = mockAttempt.mock_time_limit_seconds ?? null;
  const examTimeLimitSeconds =
    mockAttempt.mock_time_limit_at_exam_speed_seconds ?? null;

  let studentMockSpeed = mockAttempt.student_mock_speed ?? null;
  let studentExamSpeed: number | null = null;
  if (timeTakenSeconds != null && timeTakenSeconds > 0) {
    if (
      studentMockSpeed == null &&
      mockTimeLimitSeconds != null &&
      mockTimeLimitSeconds > 0
    ) {
      studentMockSpeed = mockTimeLimitSeconds / timeTakenSeconds;
    }
    if (examTimeLimitSeconds != null && examTimeLimitSeconds > 0) {
      studentExamSpeed = examTimeLimitSeconds / timeTakenSeconds;
    }
  }

  const [percentile, recentPerformance] = await Promise.all([
    getAttemptPercentile("mock", mockAttemptId),
    fetchRecentAttemptPerformance(supabase, {
      source: "mock",
      attemptId: mockAttemptId,
      attemptedAt: mockAttempt.attempted_at ?? "",
      sectionId: null,
    }),
  ]);

  const response: MockAttemptDetailResponse = {
    id: mockAttempt.id ?? "",
    ucatMockId,
    mockName,
    scaledScore,
    percentile,
    recentPerformance,
    scaledScoreMax,
    timeTakenSeconds,
    mockTimeLimitSeconds,
    examTimeLimitSeconds,
    studentMockSpeed,
    studentExamSpeed,
    attemptedAt: mockAttempt.attempted_at ?? "",
    completedAt: mockAttempt.completed_at,
    sets,
    questionAttempts,
    setBoundaryIndices,
    exam: buildAttemptReviewExam({
      sourceType: "mock",
      sourceId: ucatMockId,
      title: mockName ?? "Mock attempt",
      snapshots: orderedSnapshotAttempts.map(({ row, snapshot }) => {
        const setAttempt = (setAttemptsRaw ?? []).find((attempt) => attempt.id === row.student_question_set_attempt_id);
        return { snapshot, questionSetId: setAttempt?.question_set_id ?? "" };
      }),
    }),
  };

  return NextResponse.json(response);
}
