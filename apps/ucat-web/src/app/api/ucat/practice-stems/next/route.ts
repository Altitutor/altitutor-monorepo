import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import type { AnswerOption } from "@/features/question-engine/model/types";
import { pickStems } from "../../generated-sets/pick-stems";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";

type StemDetailQuestionFromDb = {
  id: string;
  question_text: unknown;
  answer_explanation?: unknown;
  index: number;
  question_type: "multiple_choice" | "syllogism";
  answer_options?: Array<{
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

type StemDetailRowFromDb = {
  id: string;
  section_name: string;
  display_columns: number | null;
  stem_text: unknown;
  questions: StemDetailQuestionFromDb[] | null;
};

function mapStemDetailToQuestionStemWithQuestions(
  row: StemDetailRowFromDb,
): QuestionStemWithQuestions {
  const questions = (row.questions ?? []).map((q) => {
    const options: AnswerOption[] = (q.answer_options ?? [])
      .map((opt) => {
        const rawExplanation = opt.answer_explanation
          ? (extractTextFromRichJson(
              opt.answer_explanation as JsonLike,
            )?.trim() ?? "")
          : "";
        const cleanExplanation =
          rawExplanation.toLowerCase() === "paragraph" ? "" : rawExplanation;

        return {
          id: opt.id,
          index: opt.index,
          text: extractTextFromRichJson(opt.answer_text as JsonLike),
          isAnswer: opt.is_answer ?? false,
          answerExplanation: cleanExplanation || undefined,
          selectionCount: opt.selection_count,
          totalAnswered: opt.total_answered,
          percentage: opt.percentage,
        };
      })
      .sort((a, b) => a.index - b.index);

    const rawQuestionExplanation = q.answer_explanation
      ? (extractTextFromRichJson(
          q.answer_explanation as JsonLike,
        )?.trim() ?? "")
      : "";
    const cleanQuestionExplanation =
      rawQuestionExplanation.toLowerCase() === "paragraph"
        ? ""
        : rawQuestionExplanation;

    return {
      id: q.id,
      index: q.index,
      questionText: extractTextFromRichJson(q.question_text as JsonLike),
      questionType: q.question_type,
      options,
      answerExplanation: cleanQuestionExplanation || undefined,
    };
  });

  return {
    id: row.id,
    questionSetId: "practice",
    sectionName: row.section_name ?? "",
    sectionDisplayColumns: (row.display_columns ?? 1) === 2 ? 2 : 1,
    stemText: extractTextFromRichJson(row.stem_text as JsonLike),
    questions: questions.sort((a, b) => a.index - b.index),
  };
}

/**
 * Fetches the next stem for unlimited practice mode.
 * Accepts filters + excludeStemIds. Returns 1 stem or null if none left.
 */
export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  }

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { input?: SetGeneratorInput; excludeStemIds?: string[] };
  try {
    body = (await request.json()) as {
      input?: SetGeneratorInput;
      excludeStemIds?: string[];
    };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.input;
  const excludeStemIds = body.excludeStemIds ?? [];

  if (!input?.section) {
    return NextResponse.json(
      { error: "A section must be selected." },
      { status: 400 },
    );
  }

  const result = await pickStems(supabase, input, {
    excludeStemIds,
    limitStems: 1,
  });

  if (result.chosenStemIds.length === 0) {
    return NextResponse.json({ stem: null });
  }

  const { data: stemDetails, error: stemDetailsError } = await supabase
    .from("vstudent_ucat_question_stem_detail")
    .select("id,section_name,display_columns,stem_text,questions")
    .in("id", result.chosenStemIds);

  if (stemDetailsError || !stemDetails?.length) {
    return NextResponse.json(
      { error: stemDetailsError?.message ?? "Failed to load stem details" },
      { status: 500 },
    );
  }

  const stemRow = stemDetails[0] as StemDetailRowFromDb;
  const stem = mapStemDetailToQuestionStemWithQuestions(stemRow);

  return NextResponse.json({ stem });
}
