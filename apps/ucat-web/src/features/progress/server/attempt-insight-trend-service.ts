import "server-only";

import type { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AttemptRecentPerformance } from "../lib/attempt-insights";

type SupabaseServerClient = Awaited<ReturnType<typeof getSupabaseServerClient>>;

type AttemptInsightTrendInput = {
  source: "practice" | "set" | "mock";
  attemptId: string;
  attemptedAt: string;
  /** undefined resolves the current attempt's section; null compares globally. */
  sectionId?: string | null;
};

const EMPTY_RECENT_PERFORMANCE: AttemptRecentPerformance = {
  sampleSize: 0,
  accuracyPercent: null,
  examPacePercent: null,
  examPaceSampleSize: 0,
  averageTimePerQuestionSeconds: null,
  averageTimePerQuestionSampleSize: 0,
};

export async function fetchRecentAttemptPerformance(
  supabase: SupabaseServerClient,
  input: AttemptInsightTrendInput,
): Promise<AttemptRecentPerformance> {
  let sectionId = input.sectionId;

  if (sectionId === undefined) {
    const { data: current, error } = await supabase
      .from("vstudent_ucat_progress_attempt_history")
      .select("section_id")
      .eq("source", input.source)
      .eq("id", input.attemptId)
      .maybeSingle();
    if (error || !current?.section_id) return EMPTY_RECENT_PERFORMANCE;
    sectionId = current.section_id;
  }

  let query = supabase
    .from("vstudent_ucat_progress_attempt_history")
    .select(
      "score_points, total_points, student_exam_speed, time_taken_seconds, question_count",
    )
    .eq("source", input.source)
    .neq("id", input.attemptId)
    .order("attempted_at", { ascending: false })
    .limit(5);

  if (input.attemptedAt) query = query.lt("attempted_at", input.attemptedAt);
  if (sectionId) query = query.eq("section_id", sectionId);

  const { data, error } = await query;
  if (error || !data?.length) return EMPTY_RECENT_PERFORMANCE;

  const scoreRows = data.filter(
    (row) =>
      row.score_points != null &&
      row.total_points != null &&
      row.total_points > 0,
  );
  const totalPoints = scoreRows.reduce(
    (sum, row) => sum + (row.total_points ?? 0),
    0,
  );
  const examPaces = data.flatMap((row) =>
    row.student_exam_speed != null && row.student_exam_speed > 0
      ? [row.student_exam_speed * 100]
      : [],
  );
  const practiceTimingRows = data.filter(
    (row) =>
      row.time_taken_seconds != null &&
      row.time_taken_seconds >= 0 &&
      row.question_count != null &&
      row.question_count > 0,
  );
  const practiceQuestionCount = practiceTimingRows.reduce(
    (sum, row) => sum + (row.question_count ?? 0),
    0,
  );

  return {
    sampleSize: scoreRows.length,
    accuracyPercent:
      totalPoints > 0
        ? (scoreRows.reduce((sum, row) => sum + (row.score_points ?? 0), 0) /
            totalPoints) *
          100
        : null,
    examPacePercent:
      examPaces.length > 0
        ? examPaces.reduce((sum, pace) => sum + pace, 0) / examPaces.length
        : null,
    examPaceSampleSize: examPaces.length,
    averageTimePerQuestionSeconds:
      practiceQuestionCount > 0
        ? practiceTimingRows.reduce(
            (sum, row) => sum + (row.time_taken_seconds ?? 0),
            0,
          ) / practiceQuestionCount
        : null,
    averageTimePerQuestionSampleSize: practiceTimingRows.length,
  };
}
