import { NextResponse } from "next/server";
import {
  progressPointsForQuestion,
  toProgressQuestionRef,
  type SectionProgress,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProgressSummaryResponse } from "@/features/progress/types/progress-summary";

type PublicCountRow = {
  section_id: string;
  total_questions: number;
};

export async function GET() {
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

  const [questionAttemptsRes, sectionsRes, publicCountsRes] = await Promise.all(
    [
      supabase
        .from("vstudent_ucat_my_question_attempts")
        .select(
          "id, question_id, question_stem_id, attempted_at, ucat_section_id, section_name, section_number, score, question_type",
        )
        .eq("is_submitted", true),
      supabase
        .from("vstudent_ucat_sections")
        .select("id, name, section_number")
        .order("section_number"),
      (
        supabase as unknown as {
          from: (relation: string) => {
            select: (columns: string) => Promise<{
              data: PublicCountRow[] | null;
              error: Error | null;
            }>;
          };
        }
      )
        .from("vstudent_ucat_public_question_counts")
        .select("section_id, total_questions"),
    ],
  );

  if (questionAttemptsRes.error) {
    return NextResponse.json(
      { error: questionAttemptsRes.error.message },
      { status: 500 },
    );
  }
  if (sectionsRes.error) {
    return NextResponse.json(
      { error: sectionsRes.error.message },
      { status: 500 },
    );
  }
  if (publicCountsRes.error) {
    return NextResponse.json(
      { error: publicCountsRes.error.message },
      { status: 500 },
    );
  }

  const bestByQuestion = new Map<
    string,
    NonNullable<typeof questionAttemptsRes.data>[number]
  >();
  for (const attempt of questionAttemptsRes.data ?? []) {
    const questionId = attempt.question_id ?? attempt.id;
    if (!questionId) continue;
    const existing = bestByQuestion.get(questionId);
    if (
      !existing ||
      (attempt.score ?? 0) > (existing.score ?? 0) ||
      ((attempt.score ?? 0) === (existing.score ?? 0) &&
        (attempt.attempted_at ?? "") > (existing.attempted_at ?? ""))
    ) {
      bestByQuestion.set(questionId, attempt);
    }
  }

  const sectionTotals = new Map<
    string,
    { correct: number; max: number; syllogismStems: Set<string> }
  >();
  for (const attempt of bestByQuestion.values()) {
    if (!attempt.ucat_section_id) continue;
    const totals = sectionTotals.get(attempt.ucat_section_id) ?? {
      correct: 0,
      max: 0,
      syllogismStems: new Set<string>(),
    };
    totals.correct += attempt.score ?? 0;
    totals.max += progressPointsForQuestion(
      toProgressQuestionRef({
        questionId: attempt.question_id ?? attempt.id ?? "",
        questionStemId: attempt.question_stem_id,
        questionType: attempt.question_type,
      }),
      totals.syllogismStems,
    );
    sectionTotals.set(attempt.ucat_section_id, totals);
  }

  const publicQuestionsBySection = new Map<string, number>();
  for (const row of publicCountsRes.data ?? []) {
    publicQuestionsBySection.set(
      row.section_id,
      (publicQuestionsBySection.get(row.section_id) ?? 0) +
        (row.total_questions ?? 0),
    );
  }

  const sectionProgress: SectionProgress[] = (sectionsRes.data ?? [])
    .filter(
      (section): section is typeof section & { id: string } =>
        section.id != null,
    )
    .map((section) => {
      const totals = sectionTotals.get(section.id) ?? { correct: 0, max: 0 };
      return {
        sectionId: section.id,
        sectionName: section.name ?? "Unknown",
        sectionNumber: section.section_number ?? 0,
        correctScore: totals.correct,
        maxScore: totals.max,
        percentage:
          totals.max > 0 ? Math.round((totals.correct / totals.max) * 100) : 0,
        totalPublicQuestions: publicQuestionsBySection.get(section.id),
      };
    });

  return NextResponse.json({
    sectionProgress,
  } satisfies ProgressSummaryResponse);
}
