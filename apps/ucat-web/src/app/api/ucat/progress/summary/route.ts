import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { ProgressSummaryResponse } from "@/features/progress/types/progress-summary";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { ServerTiming } from "@/lib/performance/server-timing";
import { isTransientSupabaseError } from "@/lib/supabase/transient-error";

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

  const { data, error } = await supabase.rpc(
    "get_student_ucat_progress_summary",
  );
  timing.mark("query");

  if (error) return failure(error, "progress_summary_query_error");
  if (!data) {
    return failure(
      new Error("Progress summary returned no data"),
      "progress_summary_empty",
    );
  }

  return timing.apply(
    NextResponse.json(data as unknown as ProgressSummaryResponse),
  );
}
