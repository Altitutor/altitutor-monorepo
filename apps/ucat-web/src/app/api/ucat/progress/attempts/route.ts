import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { extractTextFromRichJson } from "@/features/question-engine/model/rich-text";
import type { JsonLike } from "@/features/question-engine/model/rich-text";
import type {
  MockAttemptRow,
  PracticeAttemptRow,
  SetAttemptRow,
} from "@altitutor/shared";

const SOURCES = ["set", "practice", "mock"] as const;
export type ProgressAttemptSource = (typeof SOURCES)[number];
export type ProgressAttemptRow = SetAttemptRow | PracticeAttemptRow | MockAttemptRow;

export type ProgressAttemptsResponse = {
  attempts: ProgressAttemptRow[];
  page: number;
  pageSize: number;
  total: number;
};

type HistoryRow = {
  source: ProgressAttemptSource;
  id: string;
  section_id: string | null;
  section_name: string | null;
  resource_id: string;
  resource_name: unknown;
  is_student_generated: boolean;
  unlimited: boolean;
  attempted_at: string;
  completed_at: string | null;
  score_points: number | null;
  total_points: number | null;
  scaled_score: number | null;
  time_taken_seconds: number | null;
  time_limit_seconds: number | null;
  student_set_speed: number | null;
  student_exam_speed: number | null;
  was_timed: boolean;
  question_count: number | null;
  scaled_score_max: number | null;
};

type HistoryResult = {
  data: HistoryRow[] | null;
  error: { message: string } | null;
  count: number | null;
};

type HistoryQuery = PromiseLike<HistoryResult> & {
  eq: (column: string, value: string) => HistoryQuery;
  gte: (column: string, value: string) => HistoryQuery;
  order: (column: string, options: { ascending: boolean }) => HistoryQuery;
  range: (from: number, to: number) => HistoryQuery;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") as ProgressAttemptSource | null;
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(url.searchParams.get("pageSize")) || 10));
  const sectionNumberValue = url.searchParams.get("sectionNumber");
  const sectionNumber = sectionNumberValue == null ? null : Number(sectionNumberValue);
  const daysValue = url.searchParams.get("days");
  const days = daysValue == null ? null : Number(daysValue);

  if (!source || !SOURCES.includes(source)) {
    return NextResponse.json({ error: "Invalid attempt source" }, { status: 400 });
  }
  if (sectionNumber != null && (!Number.isInteger(sectionNumber) || sectionNumber < 1 || sectionNumber > 4)) {
    return NextResponse.json({ error: "Invalid section number" }, { status: 400 });
  }
  if (days != null && (!Number.isInteger(days) || days < 1 || days > 3650)) {
    return NextResponse.json({ error: "Invalid date range" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let sectionId: string | null = null;
  if (sectionNumber != null) {
    const sectionResult = await supabase
      .from("vstudent_ucat_sections")
      .select("id")
      .eq("section_number", sectionNumber)
      .maybeSingle();
    if (sectionResult.error) return NextResponse.json({ error: sectionResult.error.message }, { status: 500 });
    sectionId = sectionResult.data?.id ?? null;
    if (!sectionId) return NextResponse.json({ attempts: [], page, pageSize, total: 0 } satisfies ProgressAttemptsResponse);
  }

  const dynamicSupabase = supabase as unknown as {
    from: (relation: string) => {
      select: (columns: string, options: { count: "exact" }) => HistoryQuery;
    };
  };
  let query = dynamicSupabase
    .from("vstudent_ucat_progress_attempt_history")
    .select("*", { count: "exact" })
    .eq("source", source);
  if (sectionId) query = query.eq("section_id", sectionId);
  if (days != null) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days + 1);
    query = query.gte("completed_at", cutoff.toISOString());
  }
  const from = (page - 1) * pageSize;
  const result = await query
    .order("completed_at", { ascending: false })
    .order("id", { ascending: false })
    .range(from, from + pageSize - 1);

  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });

  const attempts = ((result.data ?? []) as unknown as HistoryRow[]).map((row): ProgressAttemptRow => {
    const name = extractTextFromRichJson(row.resource_name as JsonLike) || null;
    if (row.source === "set") {
      return {
        id: row.id,
        attemptedAt: row.attempted_at,
        completedAt: row.completed_at,
        questionSetId: row.resource_id,
        questionSetName: name,
        isStudentGenerated: row.is_student_generated,
        studentUcatMockAttemptId: null,
        scorePoints: row.score_points,
        totalPoints: row.total_points,
        scaledScore: row.scaled_score,
        timeTakenSeconds: row.time_taken_seconds,
        setTimeLimitSeconds: row.time_limit_seconds,
        studentSetSpeed: row.student_set_speed,
        studentExamSpeed: row.student_exam_speed,
        wasTimed: row.was_timed,
        sectionId: row.section_id,
      };
    }
    if (row.source === "practice") {
      return {
        id: row.id,
        attemptedAt: row.attempted_at,
        completedAt: row.completed_at,
        ucatSectionId: row.section_id ?? "",
        sectionName: row.section_name ?? "Unknown",
        scorePoints: row.score_points,
        totalPoints: row.total_points,
        questionCount: row.question_count,
        timeTakenSeconds: row.time_taken_seconds,
        unlimited: row.unlimited,
      };
    }
    return {
      id: row.id,
      attemptedAt: row.attempted_at,
      completedAt: row.completed_at,
      ucatMockId: row.resource_id,
      mockName: name,
      scorePoints: row.score_points,
      totalPoints: row.total_points,
      scaledScore: row.scaled_score,
      scaledScoreMax: row.scaled_score_max,
      timeTakenSeconds: row.time_taken_seconds,
      setTimeLimitSeconds: row.time_limit_seconds,
      studentSetSpeed: null,
      studentExamSpeed: row.student_exam_speed,
      wasTimed: row.was_timed,
    };
  });

  return NextResponse.json({
    attempts,
    page,
    pageSize,
    total: result.count ?? 0,
  } satisfies ProgressAttemptsResponse);
}
