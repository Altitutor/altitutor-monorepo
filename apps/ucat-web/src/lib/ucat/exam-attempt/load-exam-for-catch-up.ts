import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuestionEngineExam,
  QuestionItem,
} from "@/features/question-engine/model/types";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import type {
  StoredExamSnapshot,
  StoredExamTiming,
} from "@/lib/ucat/exam-attempt/service";

type ReaderClient = SupabaseClient;

function hasInstructionsContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

function stubQuestions(count: number, setId = ""): QuestionItem[] {
  return Array.from({ length: Math.max(count, 1) }, (_, index) => ({
    id: `stub-${index}`,
    index,
    questionSetId: setId,
    stemId: `stub-stem-${index}`,
    sectionName: "",
    sectionDisplayColumns: 1 as const,
    stemText: "",
    questionText: "",
    questionType: "multiple_choice" as const,
    options: [],
  }));
}

export function toStoredExamTiming(
  exam: QuestionEngineExam,
): StoredExamTiming {
  return {
    setModeTiming: exam.setModeTiming ?? null,
    mockTimingSegments: exam.mockTimingSegments,
    mockSetSummaries: exam.mockSetSummaries,
    timePerQuestionSeconds: exam.timePerQuestionSeconds ?? null,
  };
}

export function examFromStoredTiming(
  stored: StoredExamSnapshot,
): QuestionEngineExam | null {
  if (!stored.examTiming) return null;

  const questionCount =
    stored.examTiming.mockTimingSegments?.reduce((max, segment) => {
      if (segment.type !== "questions") return max;
      return Math.max(max, segment.questionEndIndex);
    }, 0) ?? 1;

  return {
    sourceType: stored.exam.sourceType,
    sourceId: stored.exam.sourceId,
    title: "",
    questions: stubQuestions(questionCount, stored.exam.sourceId),
    instructionsScreens: [],
    setModeTiming: stored.examTiming.setModeTiming,
    mockTimingSegments: stored.examTiming.mockTimingSegments,
    mockSetSummaries: stored.examTiming.mockSetSummaries,
    timePerQuestionSeconds: stored.examTiming.timePerQuestionSeconds,
  };
}

async function loadSetExamForCatchUp(
  reader: ReaderClient,
  setId: string,
): Promise<QuestionEngineExam | null> {
  const { data: setDetail, error } = await reader
    .from("vstudent_ucat_question_set_detail")
    .select("id, time_limit_seconds, stems")
    .eq("id", setId)
    .maybeSingle();


  if (error || !setDetail) return null;

  const stems = (setDetail.stems ?? []) as Array<{ stem_id: string }>;
  const firstStemId = stems[0]?.stem_id;
  let instructionsTimeLimitSeconds: number | null = null;

  if (firstStemId) {
    const { data: stem } = await reader
      .from("vstudent_ucat_question_stem_detail")
      .select("section_instructions_time_limit_seconds")
      .eq("id", firstStemId)
      .maybeSingle();
    instructionsTimeLimitSeconds =
      stem?.section_instructions_time_limit_seconds ?? null;
  }

  const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;

  return {
    sourceType: "set",
    sourceId: setId,
    title: "",
    questions: stubQuestions(stems.length, setId),
    instructionsScreens: [],
    setModeTiming: {
      setTimeLimitSeconds,
      instructionsTimeLimitSeconds,
    },
  };
}

async function loadMockExamForCatchUp(
  reader: ReaderClient,
  mockId: string,
): Promise<QuestionEngineExam | null> {
  const { data: mockDetail, error } = await reader
    .from("vstudent_ucat_mock_detail")
    .select("id, instructions_text, sets")
    .eq("id", mockId)
    .maybeSingle();

  if (error || !mockDetail) return null;

  const setIds = ((mockDetail.sets ?? []) as Array<{ id: string }>).map(
    (set) => set.id,
  );

  const mockTimingSegments: NonNullable<
    QuestionEngineExam["mockTimingSegments"]
  > = [];
  const mockSetSummaries: NonNullable<QuestionEngineExam["mockSetSummaries"]> =
    [];
  const instructionsScreens: QuestionEngineExam["instructionsScreens"] = [];
  let instructionsIndex = 0;
  let questionOffset = 0;

  if (hasInstructionsContent(mockDetail.instructions_text)) {
    instructionsScreens.push({
      instructionsJson: mockDetail.instructions_text as Record<string, unknown>,
    });
    mockTimingSegments.push({
      type: "instructions",
      instructionsIndex: 0,
      timeLimitSeconds: null,
    });
    instructionsIndex = 1;
  }

  for (let setIndex = 0; setIndex < setIds.length; setIndex++) {
    const setId = setIds[setIndex];
    const { data: setDetail } = await reader
      .from("vstudent_ucat_question_set_detail")
      .select("id, name, time_limit_seconds, stems")
      .eq("id", setId)
      .maybeSingle();

    if (!setDetail) continue;

    const stems = (setDetail.stems ?? []) as Array<{
      stem_id: string;
      questions_meta: Array<{ id: string }>;
    }>;
    const firstStemId = stems[0]?.stem_id;
    let instructionsTimeLimitSeconds: number | null = null;
    let sectionInstructionsJson: Record<string, unknown> | null = null;
    let hasInstructions = false;

    if (firstStemId) {
      const { data: stem } = await reader
        .from("vstudent_ucat_question_stem_detail")
        .select(
          "section_instructions_text, section_instructions_time_limit_seconds",
        )
        .eq("id", firstStemId)
        .maybeSingle();
      hasInstructions = hasInstructionsContent(
        stem?.section_instructions_text,
      );
      instructionsTimeLimitSeconds =
        stem?.section_instructions_time_limit_seconds ?? null;
      if (hasInstructions && stem?.section_instructions_text) {
        sectionInstructionsJson = stem.section_instructions_text as Record<
          string,
          unknown
        >;
      }
    }

    const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
    const isSetTimed =
      setTimeLimitSeconds != null && setTimeLimitSeconds > 0;

    if (hasInstructions) {
      instructionsScreens.push({
        instructionsJson: sectionInstructionsJson,
      });
      mockTimingSegments.push({
        type: "instructions",
        instructionsIndex,
        timeLimitSeconds: isSetTimed ? instructionsTimeLimitSeconds : null,
      });
      instructionsIndex++;
    }

    const questionCount = stems.reduce(
      (sum, stem) => sum + (stem.questions_meta?.length ?? 0),
      0,
    );
    const start = questionOffset;
    const end = questionOffset + questionCount;
    questionOffset = end;

    mockTimingSegments.push({
      type: "questions",
      setIndex,
      questionStartIndex: start,
      questionEndIndex: end,
      timeLimitSeconds: setTimeLimitSeconds,
    });
    mockSetSummaries.push({
      setIndex,
      name:
        typeof setDetail.name === "string" && setDetail.name
          ? setDetail.name
          : `Set ${setIndex + 1}`,
      questionStartIndex: start,
      questionEndIndex: end,
    });
  }

  return {
    sourceType: "mock",
    sourceId: mockId,
    title: "",
    questions: stubQuestions(questionOffset),
    instructionsScreens,
    mockTimingSegments,
    mockSetSummaries,
  };
}

async function loadPracticeExamForCatchUp(
  sessionId: string,
  timing: StoredExamTiming | null | undefined,
): Promise<QuestionEngineExam | null> {
  return {
    sourceType: "questionStem",
    sourceId: sessionId,
    title: "",
    questions: stubQuestions(1),
    instructionsScreens: [],
    timePerQuestionSeconds: timing?.timePerQuestionSeconds ?? null,
  };
}

export async function loadExamForCatchUp(
  reader: ReaderClient,
  attempt: ActiveExamAttempt,
): Promise<QuestionEngineExam | null> {
  switch (attempt.kind) {
    case "set":
      return loadSetExamForCatchUp(reader, attempt.resourceId);
    case "mock":
      return loadMockExamForCatchUp(reader, attempt.resourceId);
    case "practice":
      return loadPracticeExamForCatchUp(attempt.attemptId, null);
    default: {
      const _exhaustive: never = attempt.kind;
      return _exhaustive;
    }
  }
}

export async function resolveExamForCatchUp(
  attempt: ActiveExamAttempt,
  options: {
    exam?: QuestionEngineExam | null;
    stored?: StoredExamSnapshot | null;
    readerClient?: ReaderClient;
  },
): Promise<QuestionEngineExam | null> {
  if (options.exam) return options.exam;
  if (options.stored) {
    const fromStored = examFromStoredTiming(options.stored);
    if (fromStored) return fromStored;
  }
  if (options.readerClient) {
    return loadExamForCatchUp(options.readerClient, attempt);
  }
  return null;
}
