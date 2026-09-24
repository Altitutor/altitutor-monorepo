import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { QuestionStemWithQuestions } from "@/features/question-engine/model/types";
import {
  mapStemDetailToQuestionStemWithQuestions,
  type StemDetailRowFromDb,
} from "@/features/practice/lib/map-stem-detail-for-practice";

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

  let body: { stemIds?: string[] };
  try {
    body = (await request.json()) as { stemIds?: string[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const stemIds = Array.isArray(body.stemIds)
    ? body.stemIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (stemIds.length === 0) {
    return NextResponse.json(
      { error: "stemIds must be a non-empty array" },
      { status: 400 },
    );
  }

  if (stemIds.length > 50) {
    return NextResponse.json(
      { error: "Too many stem IDs (max 50)" },
      { status: 400 },
    );
  }

  const { data: stemDetails, error: stemDetailsError } = await supabase
    .from("vstudent_ucat_question_stem_delivery")
    .select("id,section_name,display_columns,stem_text,questions")
    .in("id", stemIds);

  if (stemDetailsError) {
    captureApiError(stemDetailsError, "/api/ucat/practice-stems/by-ids");
    return NextResponse.json(
      { error: stemDetailsError.message },
      { status: 500 },
    );
  }

  const stemRows = (stemDetails ?? []) as StemDetailRowFromDb[];
  const byId = new Map(
    stemRows.map((row) => [row.id, mapStemDetailToQuestionStemWithQuestions(row)]),
  );

  const stems: QuestionStemWithQuestions[] = stemIds
    .map((id) => byId.get(id))
    .filter((stem): stem is QuestionStemWithQuestions => stem != null);

  return NextResponse.json({ stems });
}
