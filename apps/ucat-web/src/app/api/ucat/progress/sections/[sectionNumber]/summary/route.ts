import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { SectionProgressResponse } from "@/features/progress/types/section-progress";

type ProgressRow = { category_id: string | null; correct_score: number; max_score: number };
type CountRow = { question_stem_category_id: string | null; total_questions: number };
type SetProgressRow = { total_completed: number; untimed_completed: number; timed_completed: number };

export async function GET(
  _request: Request,
  context: { params: Promise<{ sectionNumber: string }> },
) {
  const { sectionNumber: rawSectionNumber } = await context.params;
  const sectionNumber = Number(rawSectionNumber);
  if (!Number.isInteger(sectionNumber) || sectionNumber < 1 || sectionNumber > 4) {
    return NextResponse.json({ error: "Invalid section number" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sectionRes = await supabase
    .from("vstudent_ucat_sections")
    .select("id, name, section_number")
    .eq("section_number", sectionNumber)
    .maybeSingle();
  if (sectionRes.error) return NextResponse.json({ error: sectionRes.error.message }, { status: 500 });
  if (!sectionRes.data?.id) return NextResponse.json({ error: "Section not found" }, { status: 404 });
  const section = sectionRes.data;
  const sectionId = section.id as string;

  const dynamic = supabase as unknown as { from: (relation: string) => ReturnType<typeof supabase.from> };
  const [progressRes, countsRes, categoriesRes, setProgressRes, publicSetsRes] = await Promise.all([
    dynamic.from("vstudent_ucat_my_question_progress").select("category_id, correct_score, max_score").eq("section_id", sectionId),
    dynamic.from("vstudent_ucat_public_question_counts").select("question_stem_category_id, total_questions").eq("section_id", sectionId),
    supabase.from("vstudent_ucat_question_stem_categories").select("id, name").eq("ucat_section_id", sectionId),
    dynamic.from("vstudent_ucat_section_set_progress").select("total_completed, untimed_completed, timed_completed").eq("section_id", sectionId).maybeSingle(),
    supabase.from("vstudent_ucat_question_sets").select("sections, time_limit_seconds"),
  ]);
  const error = progressRes.error ?? countsRes.error ?? categoriesRes.error ?? setProgressRes.error ?? publicSetsRes.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const progressByCategory = new Map<string, { correct: number; max: number }>();
  let correctScore = 0;
  let maxScore = 0;
  for (const row of (progressRes.data ?? []) as unknown as ProgressRow[]) {
    const key = row.category_id ?? "__uncategorized__";
    progressByCategory.set(key, { correct: row.correct_score, max: row.max_score });
    correctScore += row.correct_score;
    maxScore += row.max_score;
  }
  const publicByCategory = new Map<string, number>();
  let totalPublicQuestions = 0;
  for (const row of (countsRes.data ?? []) as unknown as CountRow[]) {
    const key = row.question_stem_category_id ?? "__uncategorized__";
    publicByCategory.set(key, row.total_questions);
    totalPublicQuestions += row.total_questions;
  }
  const categoryProgress = (categoriesRes.data ?? []).flatMap((category) => {
    if (!category.id) return [];
    const totals = progressByCategory.get(category.id) ?? { correct: 0, max: 0 };
    return [{
      categoryId: category.id,
      categoryName: category.name ?? "Unknown",
      correctScore: totals.correct,
      maxScore: totals.max,
      percentage: totals.max > 0 ? Math.round((totals.correct / totals.max) * 100) : 0,
      totalPublicQuestions: publicByCategory.get(category.id),
    }];
  });
  const uncategorized = progressByCategory.get("__uncategorized__");
  if (uncategorized?.max) {
    categoryProgress.push({
      categoryId: "__uncategorized__",
      categoryName: "Uncategorized",
      correctScore: uncategorized.correct,
      maxScore: uncategorized.max,
      percentage: Math.round((uncategorized.correct / uncategorized.max) * 100),
      totalPublicQuestions: publicByCategory.get("__uncategorized__"),
    });
  }

  let totalPublicSets = 0;
  let totalPublicTimedSets = 0;
  for (const set of publicSetsRes.data ?? []) {
    const sections = set.sections as Array<{ section_number?: number }> | null;
    if (sections?.[0]?.section_number !== sectionNumber) continue;
    totalPublicSets += 1;
    if ((set.time_limit_seconds ?? 0) > 0) totalPublicTimedSets += 1;
  }
  const setProgress = setProgressRes.data as unknown as SetProgressRow | null;
  return NextResponse.json({
    section: {
      sectionId,
      sectionName: section.name ?? "Unknown",
      sectionNumber,
      correctScore,
      maxScore,
      percentage: maxScore > 0 ? Math.round((correctScore / maxScore) * 100) : 0,
      totalPublicQuestions,
    },
    categoryProgress: categoryProgress.sort((a, b) => a.categoryName.localeCompare(b.categoryName)),
    totalPublicSets,
    totalPublicUntimedSets: totalPublicSets - totalPublicTimedSets,
    totalPublicTimedSets,
    setsCompleted: setProgress?.total_completed ?? 0,
    untimedSetsCompleted: setProgress?.untimed_completed ?? 0,
    timedSetsCompleted: setProgress?.timed_completed ?? 0,
  } satisfies SectionProgressResponse);
}
