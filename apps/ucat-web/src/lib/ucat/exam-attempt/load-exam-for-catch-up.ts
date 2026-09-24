import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  QuestionEngineExam,
  QuestionItem,
} from "@/features/question-engine/model/types";
import {
  mapQuestionStemsToItems,
  type QuestionStemWithQuestions,
} from "@/features/question-engine/model/types";
import type { ActiveExamAttempt } from "@/lib/ucat/exam-attempt/types";
import type {
  StoredExamSnapshot,
  StoredExamTiming,
} from "@/lib/ucat/exam-attempt/service";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";

type ReaderClient = SupabaseClient;

function hasInstructionsContent(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (typeof value === "object") return Object.keys(value as object).length > 0;
  return false;
}

type StemInstructionRow = {
  id: string;
  section_name: string | null;
  section_instructions_text?: unknown;
  section_instructions_time_limit_seconds: number | null;
};

type SetStemMeta = {
  stem_id: string;
  questions_meta?: Array<{ id: string; index: number }> | null;
};

type FullStemRow = StemInstructionRow & {
  display_columns?: number | null;
  questions?: unknown;
};

type FullQuestionRow = {
  id: string;
  index: number;
  response_type: QuestionItem["responseType"];
  answer_scheme: QuestionItem["answerScheme"];
  answer_options?: Array<{
    id: string;
    index: number;
    answer_key_value?: "correct" | "yes" | "no" | "most" | "least" | null;
  }> | null;
};

export function mapSetQuestionsForCatchUp(
  setId: string,
  stems: SetStemMeta[],
  stemRows: FullStemRow[],
): QuestionItem[] {
  const stemById = new Map(stemRows.map((stem) => [stem.id, stem]));
  const questions: QuestionItem[] = [];

  for (const stemMeta of stems) {
    const stem = stemById.get(stemMeta.stem_id);
    if (!stem || !Array.isArray(stem.questions)) continue;
    const questionById = new Map(
      (stem.questions as FullQuestionRow[]).map((question) => [
        question.id,
        question,
      ]),
    );
    for (const meta of stemMeta.questions_meta ?? []) {
      const question = questionById.get(meta.id);
      if (!question) continue;
      const options = [...(question.answer_options ?? [])]
        .sort((left, right) => left.index - right.index)
        .map((option) => ({
          id: option.id,
          index: option.index,
          text: "",
          answerKeyValue: option.answer_key_value ?? null,
        }));
      questions.push({
        id: question.id,
        index: questions.length,
        questionSetId: setId,
        stemId: stem.id,
        sectionName: stem.section_name ?? "",
        sectionDisplayColumns: stem.display_columns === 2 ? 2 : 1,
        stemText: "",
        questionText: "",
        responseType: question.response_type,
        answerScheme: question.answer_scheme,
        options,
        correctOptionId: options.find(
          (option) => option.answerKeyValue === "correct",
        )?.id,
      });
    }
  }
  return questions;
}

function selectInstructionStem(
  stems: Array<{ stem_id: string }>,
  stemRows: StemInstructionRow[],
): StemInstructionRow | null {
  const stemById = new Map(stemRows.map((stem) => [stem.id, stem]));
  const countsBySection = new Map<string, number>();
  const firstStemBySection = new Map<string, StemInstructionRow>();

  for (const stemMeta of stems) {
    const stem = stemById.get(stemMeta.stem_id);
    if (!stem?.section_name) continue;
    countsBySection.set(
      stem.section_name,
      (countsBySection.get(stem.section_name) ?? 0) + 1,
    );
    if (!firstStemBySection.has(stem.section_name)) {
      firstStemBySection.set(stem.section_name, stem);
    }
  }

  const selectedSection = [...countsBySection.entries()].sort(
    ([aName, aCount], [bName, bCount]) =>
      bCount - aCount ||
      (SECTION_NAME_TO_NUMBER[aName] ?? Number.MAX_SAFE_INTEGER) -
        (SECTION_NAME_TO_NUMBER[bName] ?? Number.MAX_SAFE_INTEGER),
  )[0]?.[0];

  return selectedSection
    ? (firstStemBySection.get(selectedSection) ?? null)
    : null;
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
    responseType: "multiple_choice" as const,
    answerScheme: "single_choice" as const,
    options: [],
  }));
}

export function toStoredExamTiming(exam: QuestionEngineExam): StoredExamTiming {
  return {
    setModeTiming: exam.setModeTiming ?? null,
    mockTimingSegments: exam.mockTimingSegments,
    mockSetSummaries: exam.mockSetSummaries,
    timePerQuestionSeconds: exam.timePerQuestionSeconds ?? null,
    practiceSessionTimeLimitSeconds:
      exam.practiceSessionTimeLimitSeconds ?? null,
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
    practiceSessionTimeLimitSeconds:
      stored.examTiming.practiceSessionTimeLimitSeconds,
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

  const stems = (setDetail.stems ?? []) as SetStemMeta[];
  let instructionsTimeLimitSeconds: number | null = null;
  let stemRows: FullStemRow[] = [];

  if (stems.length > 0) {
    const { data } = await reader
      .from("vstudent_ucat_question_stem_detail")
      .select(
        "id, section_name, display_columns, section_instructions_time_limit_seconds, questions",
      )
      .in(
        "id",
        stems.map((stem) => stem.stem_id),
      );
    stemRows = (data ?? []) as FullStemRow[];
    const stem = selectInstructionStem(stems, stemRows);
    instructionsTimeLimitSeconds =
      stem?.section_instructions_time_limit_seconds ?? null;
  }

  const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;

  return {
    sourceType: "set",
    sourceId: setId,
    title: "",
    questions: mapSetQuestionsForCatchUp(setId, stems, stemRows),
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
  const questions: QuestionItem[] = [];

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

    const stems = (setDetail.stems ?? []) as SetStemMeta[];
    let instructionsTimeLimitSeconds: number | null = null;
    let sectionInstructionsJson: Record<string, unknown> | null = null;
    let hasInstructions = false;

    if (stems.length > 0) {
      const { data: stemRows } = await reader
        .from("vstudent_ucat_question_stem_detail")
        .select(
          "id, section_name, display_columns, section_instructions_text, section_instructions_time_limit_seconds, questions",
        )
        .in(
          "id",
          stems.map((stem) => stem.stem_id),
        );
      const stem = selectInstructionStem(
        stems,
        (stemRows ?? []) as StemInstructionRow[],
      );
      hasInstructions = hasInstructionsContent(stem?.section_instructions_text);
      instructionsTimeLimitSeconds =
        stem?.section_instructions_time_limit_seconds ?? null;
      if (hasInstructions && stem?.section_instructions_text) {
        sectionInstructionsJson = stem.section_instructions_text as Record<
          string,
          unknown
        >;
      }
      const setQuestions = mapSetQuestionsForCatchUp(
        setId,
        stems,
        (stemRows ?? []) as FullStemRow[],
      );
      questions.push(
        ...setQuestions.map((question) => ({
          ...question,
          index: questions.length + question.index,
        })),
      );
    }

    const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
    const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;

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
    questions,
    instructionsScreens,
    mockTimingSegments,
    mockSetSummaries,
  };
}

async function loadPracticeExamForCatchUp(
  reader: ReaderClient,
  sessionId: string,
  timing: StoredExamTiming | null | undefined,
): Promise<QuestionEngineExam | null> {
  const { data: session, error } = await reader
    .from("student_practice_sessions")
    .select("stems_snapshot")
    .eq("id", sessionId)
    .maybeSingle();
  if (error || !Array.isArray(session?.stems_snapshot)) return null;

  return {
    sourceType: "questionStem",
    sourceId: sessionId,
    title: "",
    questions: mapQuestionStemsToItems(
      session.stems_snapshot as unknown as QuestionStemWithQuestions[],
    ),
    instructionsScreens: [],
    timePerQuestionSeconds: timing?.timePerQuestionSeconds ?? null,
    practiceSessionTimeLimitSeconds:
      timing?.practiceSessionTimeLimitSeconds ?? null,
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
      return loadPracticeExamForCatchUp(reader, attempt.attemptId, null);
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
    requireQuestionContent?: boolean;
  },
): Promise<QuestionEngineExam | null> {
  if (options.exam) return options.exam;
  // Set and mock catch-up can reach finalization, which compiles and persists
  // every response contract. Their stored exam timing intentionally contains
  // placeholder questions only, so prefer the live delivered content whenever
  // a reader is available. Timing-only snapshots remain a fallback for
  // position recovery, never the authoritative final-answer source.
  if (
    options.readerClient &&
    (options.requireQuestionContent || attempt.kind !== "practice")
  ) {
    const fullExam = await loadExamForCatchUp(options.readerClient, attempt);
    if (fullExam?.questions.length) return fullExam;
  }
  // Practice needs the immutable delivered-stem snapshot to build and score a
  // complete final ledger. Stored timing alone intentionally contains no
  // question content.
  if (attempt.kind === "practice" && options.readerClient) {
    const practiceExam = await loadPracticeExamForCatchUp(
      options.readerClient,
      attempt.attemptId,
      options.stored?.examTiming,
    );
    if (practiceExam) return practiceExam;
  }
  if (options.stored) {
    const fromStored = examFromStoredTiming(options.stored);
    if (fromStored) return fromStored;
  }
  if (options.readerClient) {
    return loadExamForCatchUp(options.readerClient, attempt);
  }
  return null;
}
