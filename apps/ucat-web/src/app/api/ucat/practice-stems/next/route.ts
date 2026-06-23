import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { pickStems } from "../../generated-sets/pick-stems";
import type { SetGeneratorInput } from "@/features/set-generator/model/types";
import {
  mapStemDetailToQuestionStemWithQuestions,
  type StemDetailRowFromDb,
} from "@/features/practice/lib/map-stem-detail-for-practice";

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
