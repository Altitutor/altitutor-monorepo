import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MockProgressResponse } from "@/features/progress/types/mock-progress";

type SummaryRow = {
  attempt_count: number;
  average_scaled_score: number | null;
};
type SectionScoreRow = {
  section_id: string;
  average_scaled_score: number | null;
};

export async function GET() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError)
    return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const dynamic = supabase as unknown as {
    from: (relation: string) => ReturnType<typeof supabase.from>;
  };
  const [summaryRes, scoresRes, sectionsRes, totalRes, reviewedRes] =
    await Promise.all([
      dynamic
        .from("vstudent_ucat_mock_progress_summary")
        .select("attempt_count, average_scaled_score")
        .maybeSingle(),
      dynamic
        .from("vstudent_ucat_mock_section_progress")
        .select("section_id, average_scaled_score"),
      supabase
        .from("vstudent_ucat_sections")
        .select("id, name, section_number")
        .order("section_number"),
      supabase
        .from("vstudent_ucat_mocks")
        .select("id", { count: "exact", head: true }),
      supabase
        .from("student_ucat_attempt_reviews")
        .select("id", { count: "exact", head: true })
        .eq("attempt_type", "mock_attempt")
        .not("completed_at", "is", null),
    ]);
  const error =
    summaryRes.error ??
    scoresRes.error ??
    sectionsRes.error ??
    totalRes.error ??
    reviewedRes.error;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const summary = summaryRes.data as unknown as SummaryRow | null;
  const scores = new Map(
    ((scoresRes.data ?? []) as unknown as SectionScoreRow[]).map((row) => [
      row.section_id,
      row.average_scaled_score,
    ]),
  );
  const attemptCount = summary?.attempt_count ?? 0;
  return NextResponse.json({
    averageScaledScore: summary?.average_scaled_score ?? null,
    attemptCount,
    unreviewedAttemptCount: Math.max(
      0,
      attemptCount - (reviewedRes.count ?? 0),
    ),
    totalPublicMocks: totalRes.count ?? 0,
    sections: (sectionsRes.data ?? []).flatMap((section) =>
      section.id
        ? [
            {
              sectionId: section.id,
              sectionName: section.name ?? "Unknown",
              sectionNumber: section.section_number ?? 0,
              averageScaledScore: scores.get(section.id) ?? null,
            },
          ]
        : [],
    ),
  } satisfies MockProgressResponse);
}
