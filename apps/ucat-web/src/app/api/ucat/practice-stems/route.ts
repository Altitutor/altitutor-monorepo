import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import { pickStems } from "../generated-sets/pick-stems";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import {
  mapStemDetailToQuestionStemWithQuestions,
  type StemDetailRowFromDb,
} from "@/features/practice/lib/map-stem-detail-for-practice";
import {
  checkPracticeStartQuota,
  getPracticeQuotaStatusForStudent,
  quotaExceededResponse,
} from "@/lib/ucat/quota/quota-service";

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

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  let body: { input?: SetGeneratorInput };
  try {
    body = (await request.json()) as { input?: SetGeneratorInput };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const input = body.input;

  if (!input?.section) {
    return NextResponse.json(
      { error: "A section must be selected." },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const quotaStatus = await getPracticeQuotaStatusForStudent(
    supabaseAdmin,
    student.id,
  );
  const enforcePracticeQuota =
    quotaStatus != null && !quotaStatus.isQuotaExempt;

  const result = await pickStems(supabase, input, {
    allowOversizedFallback: !enforcePracticeQuota,
  });

  if (result.chosenStemIds.length === 0) {
    return NextResponse.json(
      { error: "No question stems match these filters." },
      { status: 400 },
    );
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

  const stemRows = stemDetails as StemDetailRowFromDb[];
  const orderedStems = result.chosenStemIds
    .map((id) => stemRows.find((s) => s.id === id))
    .filter((s): s is StemDetailRowFromDb => s != null);

  const stems: QuestionStemWithQuestions[] = orderedStems.map((row) =>
    mapStemDetailToQuestionStemWithQuestions(row),
  );

  const questionIds = stems.flatMap((stem) =>
    stem.questions.map((question) => question.id),
  );
  const quotaCheck = await checkPracticeStartQuota(
    supabaseAdmin,
    student.id,
    questionIds,
  );
  if (!quotaCheck.allowed) {
    return quotaExceededResponse(quotaCheck.payload);
  }

  return NextResponse.json({
    stems,
    questionCount: result.questionCount,
    totalMatchingQuestions: result.totalMatchingQuestions,
  });
}
