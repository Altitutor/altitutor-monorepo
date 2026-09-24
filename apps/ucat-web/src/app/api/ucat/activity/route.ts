import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { ServerTiming } from "@/lib/performance/server-timing";
import { isTransientSupabaseError } from "@/lib/supabase/transient-error";

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
  const timing = new ServerTiming();
  const supabase = await getSupabaseServerClient();

  const failure = (error: unknown, stage: string) => {
    timing.mark(stage);
    captureApiError(error, "/api/ucat/activity", {
      stage,
      ...timing.snapshot(),
    });
    const transient = isTransientSupabaseError(error);
    return timing.apply(
      NextResponse.json(
        {
          error:
            error instanceof Error ? error.message : "Failed to load activity",
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
  timing.mark("queries");

  if (daysRes.error) {
    return failure(daysRes.error, "activity_query_error");
  }
  if (startRes.error) {
    return failure(startRes.error, "activity_start_query_error");
  }

  const days: ActivityDay[] = (daysRes.data ?? [])
    .filter((row) => row.activity_date)
    .map((row) => ({
      dateKey: row.activity_date as string,
      questionAttempts: row.question_attempts ?? 0,
      setAttempts: row.set_attempts ?? 0,
    }));

  return timing.apply(
    NextResponse.json({
      startedAt: startRes.data?.started_at ?? null,
      timezone: startRes.data?.timezone ?? "Australia/Adelaide",
      days,
    } satisfies UcatActivityResponse),
  );
}
