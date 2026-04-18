"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type {
  QuestionEngineExam,
  QuestionEngineMode,
  QuestionItem,
} from "@/features/question-engine/model/types";

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

type StemDetailQuestion = {
  id: string;
  question_text: unknown;
  answer_explanation?: unknown;
  index: number;
  question_type: "multiple_choice" | "syllogism";
  answer_options: Array<{
    id: string;
    answer_text: unknown;
    answer_explanation?: unknown;
    index: number;
    is_answer?: boolean;
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
          const rawOptionExplanation = option.answer_explanation
            ? (extractTextFromRichJson(
                option.answer_explanation as JsonLike,
              )?.trim() ?? "")
            : "";
          const cleanOptionExplanation =
            rawOptionExplanation.toLowerCase() === "paragraph"
              ? ""
              : rawOptionExplanation;

          return {
            id: option.id,
            index: option.index,
            text: extractTextFromRichJson(option.answer_text as JsonLike),
            isAnswer: option.is_answer ?? false,
            answerExplanation: cleanOptionExplanation || undefined,
            selectionCount: option.selection_count,
            totalAnswered: option.total_answered,
            percentage: option.percentage,
          };
        })
        .sort((a, b) => a.index - b.index);
      const correctOption = options.find((o) => o.isAnswer);
      const rawQuestionExplanation = question.answer_explanation
        ? (extractTextFromRichJson(
            question.answer_explanation as JsonLike,
          )?.trim() ?? "")
        : "";
      const cleanQuestionExplanation =
        rawQuestionExplanation.toLowerCase() === "paragraph"
          ? ""
          : rawQuestionExplanation;
      const questionAnswerExplanation = cleanQuestionExplanation || undefined;
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
        options,
        correctOptionId: correctOption?.id,
        answerExplanation: questionAnswerExplanation,
      });
    });
  });

  return questions;
}

async function loadSetDetail(setId: string): Promise<SetDetailRow> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: SetDetailRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await supabase
    .from("vstudent_ucat_question_set_detail")
    .select("id,name,description,time_limit_seconds,stems")
    .eq("id", setId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load question set detail");
  }

  return data;
}

async function loadStemDetails(stemIds: string[]): Promise<StemDetailRow[]> {
  if (stemIds.length === 0) {
    return [];
  }

  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        in: (
          column: string,
          values: string[],
        ) => Promise<{
          data: StemDetailRow[] | null;
          error: { message: string } | null;
        }>;
      };
    };
  };

  const { data, error } = await supabase
    .from("vstudent_ucat_question_stem_detail")
    .select(
      "id,section_name,display_columns,section_instructions_text,section_instructions_time_limit_seconds,section_time_limit_seconds,stem_text,questions",
    )
    .in("id", stemIds);

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load question stem details");
  }

  return data;
}

async function loadMockDetail(mockId: string): Promise<MockDetailRow> {
  const supabase = getSupabaseBrowserClient() as unknown as {
    from: (table: string) => {
      select: (columns: string) => {
        eq: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: MockDetailRow | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };

  const { data, error } = await supabase
    .from("vstudent_ucat_mock_detail")
    .select("id,name,instructions_text,sets")
    .eq("id", mockId)
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "Unable to load mock detail");
  }

  return data;
}

async function buildSetExam(setId: string): Promise<QuestionEngineExam> {
  const setDetail = await loadSetDetail(setId);
  const stemIds = (setDetail.stems || []).map((stem) => stem.stem_id);
  const stemDetails = await loadStemDetails(stemIds);

  const title =
    extractTextFromRichJson(setDetail.name as JsonLike) ||
    extractTextFromRichJson(setDetail.description as JsonLike) ||
    "Question Set";

  const questions = mapSetToQuestions(setDetail, stemDetails);
  const instructionsScreens: QuestionEngineExam["instructionsScreens"] = [];
  const firstStem = stemDetails[0];
  const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
  const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;
  if (
    firstStem &&
    hasInstructionsContent(firstStem.section_instructions_text)
  ) {
    instructionsScreens.push({
      instructionsJson: firstStem.section_instructions_text as Record<
        string,
        unknown
      >,
    });
  }
  const instructionsTimeLimitSeconds =
    isSetTimed && firstStem
      ? (firstStem.section_instructions_time_limit_seconds ?? null)
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
  const mockDetail = await loadMockDetail(mockId);
  const setIds = (mockDetail.sets || []).map((set) => set.id) as string[];

  const setPayloadsWithTiming = await Promise.all(
    setIds.map(async (setId, idx) => {
      const setDetail = await loadSetDetail(setId);
      const stemIds = (setDetail.stems || []).map((stem) => stem.stem_id);
      const stemDetails = await loadStemDetails(stemIds);
      const questions = mapSetToQuestions(setDetail, stemDetails);
      const setTimeLimitSeconds = setDetail.time_limit_seconds ?? null;
      const isSetTimed = setTimeLimitSeconds != null && setTimeLimitSeconds > 0;
      const firstStem = stemDetails[0];
      const hasInstructions = !!(
        firstStem && hasInstructionsContent(firstStem.section_instructions_text)
      );
      const instructionsTimeLimitSeconds =
        isSetTimed && firstStem
          ? (firstStem.section_instructions_time_limit_seconds ?? null)
          : null;
      const sectionInstructionsJson =
        firstStem && hasInstructionsContent(firstStem.section_instructions_text)
          ? (firstStem.section_instructions_text as Record<string, unknown>)
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
    }),
  );

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
