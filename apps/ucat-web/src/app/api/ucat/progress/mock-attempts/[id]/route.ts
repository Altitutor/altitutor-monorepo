import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";

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
  attemptedAt: string;
  completedAt: string | null;
  sets: MockSetInfo[];
  questionAttempts: {
    questionNumber: number;
    questionId: string;
    setIndex: number;
    score: number | null;
    timeSpentSeconds: number | null;
    questionType: "multiple_choice" | "syllogism" | null;
    result: "correct" | "partial" | "incorrect" | "not_attempted";
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

function getOrderedQuestionIds(stems: StemWithQuestions[]): string[] {
  const ids: string[] = [];
  for (const stem of stems) {
    const questions = stem.questions_meta ?? [];
    for (const q of questions.sort((a, b) => a.index - b.index)) {
      ids.push(q.id);
    }
  }
  return ids;
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
    .select("id, ucat_mock_id, attempted_at, completed_at")
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

  const { data: setDetailsForSections } =
    mockSetIds.length > 0
      ? await supabase
          .from("vstudent_ucat_question_sets")
          .select("id, sections")
          .in("id", mockSetIds)
      : { data: [] };

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

  const { data: setAttemptsRaw, error: setAttemptsError } = await supabase
    .from("vstudent_ucat_my_set_attempts")
    .select("id, question_set_id, score_points, total_points, scaled_score")
    .eq("student_ucat_mock_attempt_id", mockAttemptId);

  if (setAttemptsError) {
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
      "question_id, score, time_spent_seconds, question_type, student_question_set_attempt_id",
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
      questionType: "multiple_choice" | "syllogism" | null;
    }
  >();
  for (const qa of allQuestionAttempts ?? []) {
    const key = `${qa.student_question_set_attempt_id}:${qa.question_id}`;
    attemptsBySetAndQuestion.set(key, {
      score: qa.score,
      timeSpentSeconds: qa.time_spent_seconds,
      questionType: qa.question_type as "multiple_choice" | "syllogism" | null,
    });
  }

  const sets: MockSetInfo[] = [];
  const questionAttempts: MockAttemptDetailResponse["questionAttempts"] = [];
  const setBoundaryIndices: number[] = [];
  let globalQuestionNumber = 0;

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

    const { data: setDetail } = await supabase
      .from("vstudent_ucat_question_set_detail")
      .select("id, stems")
      .eq("id", questionSetId)
      .maybeSingle();

    const stems = (setDetail?.stems ?? []) as StemWithQuestions[];
    const orderedQuestionIds = getOrderedQuestionIds(stems);

    for (let i = 0; i < orderedQuestionIds.length; i++) {
      globalQuestionNumber++;
      const questionId = orderedQuestionIds[i];
      const attemptData = setAttempt
        ? attemptsBySetAndQuestion.get(`${setAttempt.id}:${questionId}`)
        : undefined;

      const score = attemptData?.score ?? null;
      const timeSpentSeconds = attemptData?.timeSpentSeconds ?? null;
      const questionType = attemptData?.questionType ?? null;

      let result: "correct" | "partial" | "incorrect" | "not_attempted";
      if (attemptData == null) {
        result = "not_attempted";
      } else {
        const maxScore = questionType === "syllogism" ? 2 : 1;
        if (score == null) {
          result = "not_attempted";
        } else if (score >= maxScore) {
          result = "correct";
        } else if (score > 0) {
          result = "partial";
        } else {
          result = "incorrect";
        }
      }

      questionAttempts.push({
        questionNumber: globalQuestionNumber,
        questionId,
        setIndex,
        score,
        timeSpentSeconds,
        questionType,
        result,
      });
    }

    if (setIndex < mockSetIds.length - 1 && orderedQuestionIds.length > 0) {
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

  const response: MockAttemptDetailResponse = {
    id: mockAttempt.id ?? "",
    ucatMockId,
    mockName,
    scaledScore,
    scaledScoreMax,
    attemptedAt: mockAttempt.attempted_at ?? "",
    completedAt: mockAttempt.completed_at,
    sets,
    questionAttempts,
    setBoundaryIndices,
  };

  return NextResponse.json(response);
}
