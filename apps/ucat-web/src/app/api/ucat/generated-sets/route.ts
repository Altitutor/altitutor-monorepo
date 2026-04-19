import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sectionLabels } from "@/features/set-generator/model/mock-data";
import type {
  SetGeneratorInput,
  TimeMode,
} from "@/features/set-generator/model/types";
import { pickStems } from "./pick-stems";

type SectionRow = {
  id: string;
  section_number: number;
  time_per_question: number | null;
  number_of_questions: number | null;
};

type StemDetailRow = {
  id: string;
  section_id: string;
  questions: Array<{ id: string }> | null;
};

type GeneratorResponse = {
  setId: string;
  questionCount: number;
  totalMatchingQuestions: number;
  examTimeSeconds: number | null;
};

function computeTimeLimitSeconds(
  mode: TimeMode,
  customTimeMinutes: number | null,
  timeSpeedMultiplier: number,
  chosenStems: StemDetailRow[],
  sectionsById: Map<string, SectionRow>,
): number | null {
  if (mode === "off") {
    return null;
  }

  if (mode === "custom") {
    if (
      customTimeMinutes == null ||
      !Number.isFinite(customTimeMinutes) ||
      customTimeMinutes <= 0
    ) {
      return null;
    }
    return Math.round(customTimeMinutes * 60);
  }

  // Exam and speed modes: sum (questions in section) * (section time_per_question)
  const sectionQuestionCounts = new Map<string, number>();

  for (const stem of chosenStems) {
    const sectionId = stem.section_id;
    const increment = (stem.questions ?? []).length;
    if (increment === 0) continue;

    const current = sectionQuestionCounts.get(sectionId) ?? 0;
    sectionQuestionCounts.set(sectionId, current + increment);
  }

  let totalSeconds = 0;

  for (const [sectionId, count] of sectionQuestionCounts.entries()) {
    const section = sectionsById.get(sectionId);
    if (
      !section ||
      section.time_per_question == null ||
      section.time_per_question <= 0
    ) {
      continue;
    }
    totalSeconds += count * section.time_per_question;
  }

  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
    return null;
  }

  if (mode === "speed") {
    const multiplier =
      timeSpeedMultiplier > 0 && Number.isFinite(timeSpeedMultiplier)
        ? 1 / Math.min(1, Math.max(0.1, timeSpeedMultiplier))
        : 1;
    return Math.round(totalSeconds * multiplier);
  }

  return Math.round(totalSeconds);
}

function buildRichText(text: string) {
  return {
    type: "doc",
    content: [
      {
        type: "paragraph",
        content: [{ type: "text", text }],
      },
    ],
  };
}

export async function POST(request: NextRequest) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Supabase admin client is not configured on this environment." },
      { status: 500 },
    );
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

  const result = await pickStems(supabase, input);

  if (result.chosenStemIds.length === 0) {
    return NextResponse.json(
      {
        error: "No question stems match these filters.",
        details: { totalMatchingQuestions: 0 },
      },
      { status: 400 },
    );
  }

  const sectionsById = new Map<string, SectionRow>(
    result.sectionRows.map((row) => [row.id, row]),
  );
  const chosenStems: StemDetailRow[] = result.chosenStemIds
    .map((id) => result.stemDetailRows.find((s) => s.id === id))
    .filter((s): s is StemDetailRow => s != null);

  const timeLimitSeconds = computeTimeLimitSeconds(
    input.timeMode,
    input.customTimeMinutes,
    input.timeSpeedMultiplier ?? 1,
    chosenStems,
    sectionsById,
  );

  // 7) Persist the generated set using the admin client
  const sectionName = sectionLabels[input.section] ?? input.section;
  const title = `Practice set (${sectionName})`;
  const description =
    "Generated from filters on sections and your past attempts.";

  const { data: insertedSet, error: insertSetError } = await supabaseAdmin
    .from("question_sets")
    .insert({
      name: buildRichText(title),
      description: buildRichText(description),
      time_limit_seconds: timeLimitSeconds,
      is_student_generated: true,
      is_private: false,
    })
    .select("id")
    .maybeSingle();

  if (insertSetError || !insertedSet) {
    return NextResponse.json(
      { error: insertSetError?.message ?? "Failed to create question set" },
      { status: 500 },
    );
  }

  const setId: string = insertedSet.id;

  const stemLinks = chosenStems.map((stem, index) => ({
    question_stem_id: stem.id,
    question_set_id: setId,
    index: index + 1,
  }));

  const { error: linkError } = await supabaseAdmin
    .from("question_stems_question_sets")
    .insert(stemLinks);

  if (linkError) {
    return NextResponse.json({ error: linkError.message }, { status: 500 });
  }

  const response: GeneratorResponse = {
    setId,
    questionCount: result.questionCount,
    totalMatchingQuestions: result.totalMatchingQuestions,
    examTimeSeconds: timeLimitSeconds,
  };

  return NextResponse.json(response);
}
