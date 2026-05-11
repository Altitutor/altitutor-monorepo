import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export type ActivityDay = {
  /** YYYY-MM-DD in the student's timezone */
  dateKey: string;
  questionAttempts: number;
  setAttempts: number;
};

export type UcatActivityResponse = {
  /**
   * Earliest UCAT touchpoint for the student (subscription, class enrollment,
   * or first attempt). ISO timestamp, or null if the student has never had any
   * UCAT activity or access (in which case the heatmap should not render).
   */
  startedAt: string | null;
  /** IANA timezone used to bucket activity days (e.g. 'Australia/Adelaide') */
  timezone: string;
  /** Daily activity, ascending by dateKey */
  days: ActivityDay[];
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

  const [daysRes, startRes] = await Promise.all([
    supabase
      .from("vstudent_ucat_my_activity_daily")
      .select("activity_date, question_attempts, set_attempts")
      .order("activity_date", { ascending: true }),
    supabase
      .from("vstudent_ucat_my_activity_start")
      .select("started_at, timezone")
      .maybeSingle(),
  ]);

  if (daysRes.error) {
    return NextResponse.json({ error: daysRes.error.message }, { status: 500 });
  }
  if (startRes.error) {
    return NextResponse.json(
      { error: startRes.error.message },
      { status: 500 },
    );
  }

  const days: ActivityDay[] = (daysRes.data ?? [])
    .filter((row) => row.activity_date)
    .map((row) => ({
      dateKey: row.activity_date as string,
      questionAttempts: row.question_attempts ?? 0,
      setAttempts: row.set_attempts ?? 0,
    }));

  return NextResponse.json({
    startedAt: startRes.data?.started_at ?? null,
    timezone: startRes.data?.timezone ?? "Australia/Adelaide",
    days,
  } satisfies UcatActivityResponse);
}
