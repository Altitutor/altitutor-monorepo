import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  extractTextFromRichJson,
  type JsonLike,
} from "@/features/question-engine/model/rich-text";
import type {
  AnswerOption,
  QuestionEngineQuestion,
} from "@/features/question-engine/model/types";

type RouteContext = { params: Promise<{ questionId: string }> };

type StemDetailQuestion = {
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
  }>;
};

type StemDetailRow = {
  id: string;
  section_name: string;
  display_columns: number | null;
  stem_text: unknown;
  questions: StemDetailQuestion[] | null;
};

export async function GET(request: NextRequest, context: RouteContext) {
  const { questionId } = await context.params;
  const blockId = request.nextUrl.searchParams.get("blockId");

  if (!blockId) {
    return NextResponse.json({ error: "Missing blockId" }, { status: 400 });
  }

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
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const { data: block, error: blockError } = await supabase
    .from("vstudent_ucat_learning_module_blocks")
    .select("id, block_type, question_id")
    .eq("id", blockId)
    .maybeSingle();

  if (blockError) {
    return NextResponse.json({ error: blockError.message }, { status: 500 });
  }
  if (!block || block.block_type !== "question" || block.question_id !== questionId) {
    return NextResponse.json({ error: "Question block not found" }, { status: 404 });
  }

  const { data: questionMeta, error: questionMetaError } = await supabaseAdmin
    .from("ucat_questions")
    .select("id, question_stem_id")
    .eq("id", questionId)
    .is("deleted_at", null)
    .maybeSingle();

  if (questionMetaError) {
    return NextResponse.json({ error: questionMetaError.message }, { status: 500 });
  }
  if (!questionMeta?.question_stem_id) {
    return NextResponse.json({ error: "Question not found" }, { status: 404 });
  }

  const { data: stemRow, error: stemError } = await supabase
    .from("vstudent_ucat_question_stem_detail")
    .select("id, section_name, display_columns, stem_text, questions")
    .eq("id", questionMeta.question_stem_id)
    .maybeSingle();

  if (stemError) {
    return NextResponse.json({ error: stemError.message }, { status: 500 });
  }
  if (!stemRow) {
    return NextResponse.json({ error: "Question stem not found" }, { status: 404 });
  }

  const stem = stemRow as StemDetailRow;
  const questions = Array.isArray(stem.questions) ? stem.questions : [];
  const question = questions.find((row) => row.id === questionId);
  if (!question) {
    return NextResponse.json({ error: "Question not found in stem" }, { status: 404 });
  }

  const options: AnswerOption[] = (question.answer_options ?? [])
    .map((opt) => ({
      id: opt.id,
      index: opt.index,
      text: extractTextFromRichJson(opt.answer_text as JsonLike),
      isAnswer: opt.is_answer ?? false,
      answerExplanation: opt.answer_explanation
        ? extractTextFromRichJson(opt.answer_explanation as JsonLike)
        : undefined,
    }))
    .sort((a, b) => a.index - b.index);

  const payload: QuestionEngineQuestion = {
    id: question.id,
    stemId: stem.id,
    sectionName: stem.section_name,
    sectionDisplayColumns: (stem.display_columns ?? 1) === 2 ? 2 : 1,
    stemText: extractTextFromRichJson(stem.stem_text as JsonLike),
    questionText: extractTextFromRichJson(question.question_text as JsonLike),
    questionType: question.question_type,
    options,
    answerExplanation: question.answer_explanation
      ? extractTextFromRichJson(question.answer_explanation as JsonLike)
      : undefined,
  };

  return NextResponse.json(payload);
}
