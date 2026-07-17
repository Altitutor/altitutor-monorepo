import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const SOURCES = ["set", "practice", "mock"] as const;
export type ProgressSeriesSource = (typeof SOURCES)[number];

export type DailyProgressSeriesPoint = {
  date: string;
  attemptCount: number;
  scaledScoreSum: number;
  scaledScoreCount: number;
  scorePointsSum: number;
  totalPointsSum: number;
  timeTakenSecondsSum: number;
  timeTakenCount: number;
  timeLimitSecondsSum: number;
  examSpeedPercentSum: number;
  examSpeedCount: number;
};

export type ProgressSeriesResponse = {
  granularity: "day";
  points: DailyProgressSeriesPoint[];
};

type SeriesRow = {
  activity_date: string;
  attempt_count: number;
  scaled_score_sum: number;
  scaled_score_count: number;
  score_points_sum: number;
  total_points_sum: number;
  time_taken_seconds_sum: number;
  time_taken_count: number;
  time_limit_seconds_sum: number;
  exam_speed_percent_sum: number;
  exam_speed_count: number;
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  const source = url.searchParams.get("source") as ProgressSeriesSource | null;
  const sectionNumberValue = url.searchParams.get("sectionNumber");
  const sectionNumber = sectionNumberValue == null ? null : Number(sectionNumberValue);

  if (!source || !SOURCES.includes(source)) {
    return NextResponse.json({ error: "Invalid progress series source" }, { status: 400 });
  }
  if (
    sectionNumberValue != null &&
    (!Number.isInteger(sectionNumber) || sectionNumber! < 1 || sectionNumber! > 4)
  ) {
    return NextResponse.json({ error: "Invalid section number" }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) return NextResponse.json({ error: "Failed to get user" }, { status: 500 });
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let sectionId: string | null = null;
  if (sectionNumber != null) {
    const sectionRes = await supabase
      .from("vstudent_ucat_sections")
      .select("id")
      .eq("section_number", sectionNumber)
      .maybeSingle();
    if (sectionRes.error) {
      return NextResponse.json({ error: sectionRes.error.message }, { status: 500 });
    }
    sectionId = sectionRes.data?.id ?? null;
  }

  const client = supabase as unknown as {
    from: (relation: string) => {
      select: (columns: string) => {
        eq: (column: string, value: string) => {
          eq: (column: string, value: string) => {
            order: (column: string) => Promise<{ data: SeriesRow[] | null; error: Error | null }>;
          };
          order: (column: string) => Promise<{ data: SeriesRow[] | null; error: Error | null }>;
        };
      };
    };
  };
  const columns = "activity_date, attempt_count, scaled_score_sum, scaled_score_count, score_points_sum, total_points_sum, time_taken_seconds_sum, time_taken_count, time_limit_seconds_sum, exam_speed_percent_sum, exam_speed_count";
  const sourceQuery = client
    .from("vstudent_ucat_progress_series_daily")
    .select(columns)
    .eq("source", source);
  const result = sectionNumber != null
    ? sectionId == null
      ? { data: [] as SeriesRow[], error: null }
      : await sourceQuery.eq("section_id", sectionId).order("activity_date")
    : await sourceQuery.order("activity_date");

  if (result.error) {
    return NextResponse.json({ error: result.error.message }, { status: 500 });
  }

  return NextResponse.json({
    granularity: "day",
    points: (result.data ?? []).map((row) => ({
      date: row.activity_date,
      attemptCount: row.attempt_count,
      scaledScoreSum: Number(row.scaled_score_sum),
      scaledScoreCount: row.scaled_score_count,
      scorePointsSum: Number(row.score_points_sum),
      totalPointsSum: Number(row.total_points_sum),
      timeTakenSecondsSum: Number(row.time_taken_seconds_sum),
      timeTakenCount: row.time_taken_count,
      timeLimitSecondsSum: Number(row.time_limit_seconds_sum),
      examSpeedPercentSum: Number(row.exam_speed_percent_sum),
      examSpeedCount: row.exam_speed_count,
    })),
  } satisfies ProgressSeriesResponse);
}
