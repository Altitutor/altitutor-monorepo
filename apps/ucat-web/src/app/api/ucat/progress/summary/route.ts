import { NextResponse } from "next/server";
import type { SectionProgress } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProgressSummaryResponse } from "@/features/progress/types/progress-summary";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { ServerTiming } from "@/lib/performance/server-timing";
import { isTransientSupabaseError } from "@/lib/supabase/transient-error";

type PublicCountRow = {
  section_id: string;
  total_questions: number;
};

type QuestionProgressRow = {
  section_id: string;
  correct_score: number;
  max_score: number;
};

export async function GET() {
  const timing = new ServerTiming();
  const supabase = await getSupabaseServerClient();
  const failure = (error: unknown, stage: string) => {
    timing.mark(stage);
    captureApiError(error, "/api/ucat/progress/summary", {
      stage,
      ...timing.snapshot(),
    });
    const transient = isTransientSupabaseError(error);
    return timing.apply(
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to load progress",
        },
        {
          status: transient ? 503 : 500,
          headers: transient ? { "Retry-After": "5" } : undefined,
        },
      ),
    );
  };
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  timing.mark("auth");

  if (authError) {
    return failure(authError, "auth_error");
  }
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [questionProgressRes, sectionsRes, publicCountsRes] = await Promise.all(
    [
      (
        supabase as unknown as {
          from: (relation: string) => {
            select: (columns: string) => Promise<{
              data: QuestionProgressRow[] | null;
              error: Error | null;
            }>;
          };
        }
      )
        .from("vstudent_ucat_my_question_progress")
        .select("section_id, correct_score, max_score"),
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
  timing.mark("queries");

  if (questionProgressRes.error) {
    return failure(questionProgressRes.error, "question_progress_query_error");
  }
  if (sectionsRes.error) {
    return failure(sectionsRes.error, "sections_query_error");
  }
  if (publicCountsRes.error) {
    return failure(publicCountsRes.error, "public_counts_query_error");
  }

  const sectionTotals = new Map<string, { correct: number; max: number }>();
  for (const row of questionProgressRes.data ?? []) {
    const totals = sectionTotals.get(row.section_id) ?? {
      correct: 0,
      max: 0,
    };
    totals.correct += row.correct_score;
    totals.max += row.max_score;
    sectionTotals.set(row.section_id, totals);
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

  return timing.apply(
    NextResponse.json({
      sectionProgress,
    } satisfies ProgressSummaryResponse),
  );
}
