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
    answerSnapshot: Record<string, boolean> | null;
    categoryName: string | null;
    categoryDescription: string | null;
    questionStemCategoryId: string | null;
  }[];
  /** Indices (0-based) after which to draw set divider (last question index of each set except final) */
  setBoundaryIndices: number[];
};

type StemWithQuestions = {
  stem_id: string;
  stem_text?: string;
  questions_meta?: Array<{ id: string; index: number }>;
};

type MockSetFromDetail = {
  id: string;
  name?: JsonLike;
  description?: unknown;
  time_limit_seconds?: number | null;
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
  const mockAttemptId = params.id;

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

  const { data: mockAttempt, error: mockError } = await supabase
    .from("vstudent_ucat_my_mock_attempts")
    .select(
      "id, ucat_mock_id, attempted_at, completed_at, time_taken, mock_time_limit_seconds, mock_time_limit_at_exam_speed_seconds, student_mock_speed",
    )
    .eq("id", mockAttemptId)
    .maybeSingle();

  if (mockError) {
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

  const { data: mockDetail, error: mockDetailError } = await supabase
    .from("vstudent_ucat_mock_detail")
    .select("id, name, sets")
    .eq("id", ucatMockId)
    .maybeSingle();

  if (mockDetailError) {
    return NextResponse.json(
      { error: mockDetailError.message },
      { status: 500 },
    );
  }

  const mockSets = (mockDetail?.sets ?? []) as MockSetFromDetail[];
  const mockSetIds = mockSets.map((s) => s.id);

  const [setSectionsResult, setAttemptsResult, setDetailsResult] =
    await Promise.all([
      mockSetIds.length > 0
        ? supabase
            .from("vstudent_ucat_question_sets")
            .select("id, sections")
            .in("id", mockSetIds)
        : Promise.resolve({ data: [] }),
      supabase
        .from("vstudent_ucat_my_set_attempts")
        .select("id, question_set_id, score_points, total_points, scaled_score")
        .eq("student_ucat_mock_attempt_id", mockAttemptId),
      mockSetIds.length > 0
        ? supabase
            .from("vstudent_ucat_question_set_detail")
            .select("id, stems")
            .in("id", mockSetIds)
        : Promise.resolve({ data: [] }),
    ]);

  const { data: setDetailsForSections } = setSectionsResult;

  const sectionNumberBySetId = new Map<string, number>();
  for (const s of setDetailsForSections ?? []) {
    const sections = s.sections as Array<{ section_number?: number }> | null;
    const firstNum =
      Array.isArray(sections) && sections.length > 0
        ? sections[0]?.section_number
        : undefined;
    if (firstNum != null && s.id) sectionNumberBySetId.set(s.id, firstNum);
  }

  const SITUATIONAL_JUDGEMENT_SECTION = 4;

  const { data: setAttemptsRaw, error: setAttemptsError } = setAttemptsResult;

  if (setAttemptsError) {
    return NextResponse.json(
      { error: setAttemptsError.message },
      { status: 500 },
    );
  }

  const setAttemptsBySetId = new Map(
    (setAttemptsRaw ?? []).map((a) => [a.question_set_id, a]),
  );

  const setDetailsById = new Map(
    (setDetailsResult.data ?? []).map((detail) => [detail.id, detail]),
  );

  const { data: allQuestionAttempts, error: qaError } = await supabase
    .from("vstudent_ucat_my_question_attempts")
    .select(
      "question_id, score, time_spent_seconds, time_burden_seconds, question_type, student_question_set_attempt_id, question_answer_option_id, answer_snapshot, category_name, question_stem_category_id, is_flagged",
    )
    .in(
      "student_question_set_attempt_id",
      (setAttemptsRaw ?? []).map((a) => a.id).filter(Boolean),
    )
    .eq("is_submitted", true);

  if (qaError) {
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
      answerSnapshot: Record<string, boolean> | null;
      categoryName: string | null;
      questionStemCategoryId: string | null;
      isFlagged: boolean;
    }
  >();
  for (const qa of allQuestionAttempts ?? []) {
    const key = `${qa.student_question_set_attempt_id}:${qa.question_id}`;
    attemptsBySetAndQuestion.set(key, {
      score: qa.score,
      timeSpentSeconds: qa.time_spent_seconds,
      timeBurdenSeconds: qa.time_burden_seconds,
      questionType: qa.question_type as "multiple_choice" | "syllogism" | null,
      questionAnswerOptionId: qa.question_answer_option_id ?? null,
      answerSnapshot: parseAnswerSnapshot(qa.answer_snapshot),
      categoryName: qa.category_name ?? null,
      questionStemCategoryId: qa.question_stem_category_id ?? null,
      isFlagged: qa.is_flagged ?? false,
    });
  }

  const sets: MockSetInfo[] = [];
  const questionAttempts: MockAttemptDetailResponse["questionAttempts"] = [];
  const setBoundaryIndices: number[] = [];
  let globalQuestionNumber = 0;

  const allStemIds: string[] = [];
  for (const setDetail of setDetailsResult.data ?? []) {
    const stems = (setDetail.stems ?? []) as StemWithQuestions[];
    allStemIds.push(...stems.map((s) => s.stem_id).filter(Boolean));
  }
  const allQuestionIds = [
    ...new Set(
      (allQuestionAttempts ?? [])
        .map((qa) => qa.question_id)
        .filter((id): id is string => !!id),
    ),
  ];
  const [syllogismOptionsByQuestionId, questionMetadata, stemCategoryMap] =
    await Promise.all([
      fetchSyllogismOptionsByQuestionId(supabase, allStemIds),
      fetchAttemptReviewQuestionMetadata(supabase, allQuestionIds),
      fetchAttemptReviewStemCategories(supabase, allStemIds),
    ]);
  const categoryDescriptions = await fetchAttemptReviewCategoryDescriptions(
    supabase,
    [
      ...(allQuestionAttempts ?? [])
        .map((qa) => qa.question_stem_category_id)
        .filter((id): id is string => !!id),
      ...Array.from(stemCategoryMap.values()).map(
        (category) => category.categoryId,
      ),
    ],
  );

  for (let setIndex = 0; setIndex < mockSetIds.length; setIndex++) {
    const questionSetId = mockSetIds[setIndex];
    const setAttempt = setAttemptsBySetId.get(questionSetId);
    const mockSet = mockSets[setIndex];

    const setAttemptId = setAttempt?.id ?? "";
    const questionSetName =
      mockSet?.name != null
        ? extractTextFromRichJson(mockSet.name as JsonLike) || null
        : null;

    sets.push({
      setAttemptId,
      questionSetId,
      questionSetName,
      scorePoints: setAttempt?.score_points ?? null,
      totalPoints: setAttempt?.total_points ?? null,
      scaledScore: setAttempt?.scaled_score ?? null,
    });

    const setDetail = setDetailsById.get(questionSetId);
    const stems = (setDetail?.stems ?? []) as StemWithQuestions[];
    let currentStemId: string | null = null;
    let stemIndex = 0;

    for (const stem of stems) {
      const questions = (stem.questions_meta ?? []).sort(
        (a, b) => a.index - b.index,
      );
      if (stem.stem_id !== currentStemId) {
        currentStemId = stem.stem_id;
        stemIndex += 1;
      }

      for (const q of questions) {
        globalQuestionNumber++;
        const questionId = q.id;
        const attemptData = setAttempt
          ? attemptsBySetAndQuestion.get(`${setAttempt.id}:${questionId}`)
          : undefined;
        const stemCategory = stemCategoryMap.get(stem.stem_id);

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
          attemptData?.questionStemCategoryId ??
          stemCategory?.categoryId ??
          null;
        const categoryDescription = questionStemCategoryId
          ? (categoryDescriptions.get(questionStemCategoryId) ?? null)
          : null;

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
          difficulty: metadata?.difficulty ?? null,
          questionTags: metadata?.questionTags ?? [],
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
    }

    if (setIndex < mockSetIds.length - 1 && stems.length > 0) {
      setBoundaryIndices.push(globalQuestionNumber - 1);
    }
  }

  const mockName =
    mockDetail?.name != null
      ? extractTextFromRichJson(mockDetail.name as JsonLike) || null
      : null;

  const scoredSetCount = sets.filter((s) => {
    const sectionNum = s.questionSetId
      ? sectionNumberBySetId.get(s.questionSetId)
      : undefined;
    return sectionNum !== SITUATIONAL_JUDGEMENT_SECTION;
  }).length;

  const scaledScore =
    sets.length > 0
      ? sets.reduce((sum, s) => {
          const sectionNum = s.questionSetId
            ? sectionNumberBySetId.get(s.questionSetId)
            : undefined;
          if (sectionNum === SITUATIONAL_JUDGEMENT_SECTION) return sum;
          return sum + (s.scaledScore ?? 0);
        }, 0)
      : null;

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

  const response: MockAttemptDetailResponse = {
    id: mockAttempt.id ?? "",
    ucatMockId,
    mockName,
    scaledScore,
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
  };

  return NextResponse.json(response);
}
