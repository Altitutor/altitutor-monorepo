"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extractTextFromRichJson,
  mapRichExplanation,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type {
  AnswerOption,
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionItem,
} from "@/features/question-engine/model/types";
import { SECTION_NAME_TO_NUMBER } from "@/features/sets/lib/section-labels";

type SetDetailStem = {
  stem_id: string;
  stem_text: unknown;
  questions_meta: Array<{ id: string; index: number }>;
};

type SetDetailRow = {
  id: string;
  name?: unknown;
  description: unknown;
  time_limit_seconds: number | null;
  stems: SetDetailStem[];
};

type MockSetMeta = {
  id: string;
};

type MockDetailRow = {
  id: string;
  name: string;
  instructions_text: unknown;
  sets: MockSetMeta[];
};

type SetEnginePayload = {
  source_type: "set";
  set_detail: SetDetailRow;
  stem_details: StemDetailRow[];
};

type MockEnginePayload = {
  source_type: "mock";
  mock_detail: MockDetailRow;
  sets: Array<{
    set_detail: SetDetailRow;
    stem_details: StemDetailRow[];
  }>;
};

type StemDetailQuestion = {
  id: string;
  question_text: unknown;
  answer_explanation?: unknown;
  index: number;
  question_type: "multiple_choice" | "syllogism";
  response_type?: "multiple_choice" | "drag_and_drop";
  answer_scheme?: QuestionItem["answerScheme"];
  answer_options: Array<{
    id: string;
    answer_text: unknown;
    answer_explanation?: unknown;
    index: number;
    is_answer?: boolean;
    answer_key_value?: AnswerOption["answerKeyValue"];
    selection_count?: number;
    total_answered?: number;
    percentage?: number;
  }>;
};

type StemDetailRow = {
  id: string;
  section_name: string;
  display_columns: number | null;
  section_instructions_text: unknown;
  section_instructions_time_limit_seconds: number | null;
  section_time_limit_seconds: number | null;
  stem_text: unknown;
  questions: StemDetailQuestion[];
};

function hasInstructionsContent(value: unknown): boolean {
  if (value == null || typeof value !== "object") return false;
  const obj = value as Record<string, unknown>;
  const content = obj.content;
  return Array.isArray(content) && content.length > 0;
}

function selectInstructionStem(
  set: SetDetailRow,
  stemDetails: StemDetailRow[],
): StemDetailRow | null {
  const stemMap = new Map(stemDetails.map((stem) => [stem.id, stem]));
  const countsBySection = new Map<string, number>();
  const firstStemBySection = new Map<string, StemDetailRow>();

  for (const stemMeta of set.stems ?? []) {
    const stem = stemMap.get(stemMeta.stem_id);
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

type DbQuestionEngineMode = Extract<QuestionEngineMode, "set" | "mock">;

/**
 * Maps set detail to QuestionItems. Order: stem index in set first, then question index within stem.
 * The DB view provides stems ordered by question_stems_question_sets.index and questions_meta
 * ordered by ucat_questions.index within each stem.
 */
function mapSetToQuestions(
  set: SetDetailRow,
  stemDetails: StemDetailRow[],
): QuestionItem[] {
  const stemMap = new Map(stemDetails.map((stem) => [stem.id, stem]));
  const questions: QuestionItem[] = [];
  let runningIndex = 0;

  set.stems.forEach((stemMeta) => {
    const stem = stemMap.get(stemMeta.stem_id);
    if (!stem) {
      return;
    }

    const questionMap = new Map(
      stem.questions.map((question) => [question.id, question]),
    );

    stemMeta.questions_meta.forEach((questionMeta) => {
      const question = questionMap.get(questionMeta.id);
      if (!question) {
        return;
      }

      const options = (question.answer_options || [])
        .map((option) => {
          const optionExplanation = mapRichExplanation(
            option.answer_explanation,
          );

          return {
            id: option.id,
            index: option.index,
            text: extractTextFromRichJson(option.answer_text as JsonLike),
            textJson:
              option.answer_text != null &&
              typeof option.answer_text === "object"
                ? (option.answer_text as Record<string, unknown>)
                : null,
            isAnswer: option.is_answer ?? false,
            answerKeyValue: option.answer_key_value ?? null,
            answerExplanation: optionExplanation.text,
            answerExplanationJson: optionExplanation.json,
            selectionCount: option.selection_count,
            totalAnswered: option.total_answered,
            percentage: option.percentage,
          };
        })
        .sort((a, b) => a.index - b.index);
      const correctOption = options.find((o) => o.isAnswer);
      const questionExplanation = mapRichExplanation(
        question.answer_explanation,
      );
      const stemJson =
        stem.stem_text != null && typeof stem.stem_text === "object"
          ? (stem.stem_text as Record<string, unknown>)
          : null;
      const questionJson =
        question.question_text != null &&
        typeof question.question_text === "object"
          ? (question.question_text as Record<string, unknown>)
          : null;

      questions.push({
        id: question.id,
        index: runningIndex++,
        questionSetId: set.id,
        stemId: stem.id,
        sectionName: stem.section_name,
        sectionDisplayColumns: (stem.display_columns ?? 1) === 2 ? 2 : 1,
        stemText: extractTextFromRichJson(stem.stem_text as JsonLike),
        questionText: extractTextFromRichJson(
          question.question_text as JsonLike,
        ),
        stemJson,
        questionJson,
        questionType: question.question_type,
        responseType: question.response_type,
        answerScheme: question.answer_scheme,
        options,
        correctOptionId: correctOption?.id,
        answerExplanation: questionExplanation.text,
        answerExplanationJson: questionExplanation.json,
      });
    });
  });

  return questions;
}

async function loadEnginePayload(
  sourceType: DbQuestionEngineMode,
  sourceId: string,
): Promise<SetEnginePayload | MockEnginePayload> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    rpc: (
      fn: string,
      args: { p_source_type: DbQuestionEngineMode; p_source_id: string },
    ) => Promise<{
      data: SetEnginePayload | MockEnginePayload | null;
      error: { message: string } | null;
    }>;
  };
  const { data, error } = await supabase.rpc(
    "get_student_ucat_question_engine_payload",
    { p_source_type: sourceType, p_source_id: sourceId },
  );

  if (error || !data || data.source_type !== sourceType) {
    throw new Error(error?.message ?? `Unable to load ${sourceType} detail`);
  }

  return data;
}

async function buildSetExam(setId: string): Promise<QuestionEngineExam> {
  const payload = await loadEnginePayload("set", setId);
  if (payload.source_type !== "set") {
    throw new Error("Unable to load question set detail");
  }
  const setDetail = payload.set_detail;
  const stemDetails = payload.stem_details;

  const title =
    extractTextFromRichJson(setDetail.name as JsonLike) ||
    extractTextFromRichJson(setDetail.description as JsonLike) ||
    "Question Set";

  const questions = mapSetToQuestions(setDetail, stemDetails);
  const instructionsScreens: QuestionEngineExam["instructionsScreens"] = [];
  const instructionStem = selectInstructionStem(setDetail, stemDetails);
  const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
  const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;
  if (
    instructionStem &&
    hasInstructionsContent(instructionStem.section_instructions_text)
  ) {
    instructionsScreens.push({
      instructionsJson: instructionStem.section_instructions_text as Record<
        string,
        unknown
      >,
    });
  }
  const instructionsTimeLimitSeconds =
    isSetTimed && instructionStem
      ? (instructionStem.section_instructions_time_limit_seconds ?? null)
      : null;

  return {
    sourceType: "set",
    sourceId: setId,
    title,
    questions,
    instructionsScreens,
    setModeTiming: {
      setTimeLimitSeconds,
      instructionsTimeLimitSeconds,
    },
  };
}

type SetPayloadWithTiming = {
  name: string;
  questions: QuestionItem[];
  setTimeLimitSeconds: number | null;
  instructionsTimeLimitSeconds: number | null;
  hasInstructions: boolean;
  /** Section instructions JSON when hasInstructions; from first stem. */
  sectionInstructionsJson: Record<string, unknown> | null;
};

async function buildMockExam(mockId: string): Promise<QuestionEngineExam> {
  const payload = await loadEnginePayload("mock", mockId);
  if (payload.source_type !== "mock") {
    throw new Error("Unable to load mock detail");
  }
  const mockDetail = payload.mock_detail;
  const setIds = (mockDetail.sets || []).map((set) => set.id) as string[];
  const setPayloadById = new Map(
    payload.sets.map((setPayload) => [setPayload.set_detail.id, setPayload]),
  );

  const setPayloadsWithTiming = setIds.map((setId, idx) => {
    const setPayload = setPayloadById.get(setId);
    if (!setPayload) {
      throw new Error(`Unable to load question set detail: ${setId}`);
    }
    const setDetail = setPayload.set_detail;
    const stemDetails = setPayload.stem_details;
    const questions = mapSetToQuestions(setDetail, stemDetails);
    const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
    const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;
    const instructionStem = selectInstructionStem(setDetail, stemDetails);
    const hasInstructions = !!(
      instructionStem &&
      hasInstructionsContent(instructionStem.section_instructions_text)
    );
    const instructionsTimeLimitSeconds =
      isSetTimed && instructionStem
        ? (instructionStem.section_instructions_time_limit_seconds ?? null)
        : null;
    const sectionInstructionsJson =
      instructionStem &&
      hasInstructionsContent(instructionStem.section_instructions_text)
        ? (instructionStem.section_instructions_text as Record<string, unknown>)
        : null;
    return {
      name:
        (setDetail.name && typeof setDetail.name === "string"
          ? setDetail.name
          : null) ?? `Set ${idx + 1}`,
      questions,
      setTimeLimitSeconds,
      instructionsTimeLimitSeconds,
      hasInstructions,
      sectionInstructionsJson,
    } satisfies SetPayloadWithTiming;
  });

  const instructionsScreens: QuestionEngineExam["instructionsScreens"] = [];
  const mockTimingSegments: NonNullable<
    QuestionEngineExam["mockTimingSegments"]
  > = [];
  const mockSetSummaries: NonNullable<QuestionEngineExam["mockSetSummaries"]> =
    [];
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

  for (let setIndex = 0; setIndex < setPayloadsWithTiming.length; setIndex++) {
    const set = setPayloadsWithTiming[setIndex];
    const setTimeLimitSeconds = set.setTimeLimitSeconds;
    const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;

    if (set.hasInstructions) {
      instructionsScreens.push({
        instructionsJson: set.sectionInstructionsJson,
      });
      mockTimingSegments.push({
        type: "instructions",
        instructionsIndex,
        timeLimitSeconds: isSetTimed ? set.instructionsTimeLimitSeconds : null,
      });
      instructionsIndex++;
    }

    const start = questionOffset;
    const end = questionOffset + set.questions.length;
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
      name: set.name,
      questionStartIndex: start,
      questionEndIndex: end,
    });
  }

  const questions = setPayloadsWithTiming.flatMap((s) => s.questions);

  return {
    sourceType: "mock",
    sourceId: mockId,
    title: mockDetail.name || "UCAT Mock",
    questions,
    instructionsScreens,
    mockTimingSegments,
    mockSetSummaries,
  };
}

export async function getQuestionEngineExam(params: {
  mode: DbQuestionEngineMode;
  setId?: string;
  mockId?: string;
}): Promise<QuestionEngineExam> {
  if (params.mode === "set") {
    if (!params.setId) {
      throw new Error("setId is required for set mode");
    }
    return buildSetExam(params.setId);
  }

  if (!params.mockId) {
    throw new Error("mockId is required for mock mode");
  }

  return buildMockExam(params.mockId);
}
