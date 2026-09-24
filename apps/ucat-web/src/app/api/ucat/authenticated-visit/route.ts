import { NextResponse } from "next/server";
import { waitUntil } from "@vercel/functions";
import { processPendingPreparationRefreshes } from "@/features/preparation/server/preparation-refresh-worker";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase.rpc(
      "record_current_ucat_authenticated_visit",
    );
    if (error) throw error;
    const visit = data?.[0];
    if (
      visit?.refresh_pending &&
      process.env.VERCEL_ENV !== "production" &&
      supabaseAdmin
    ) {
      const studentResult = await supabaseAdmin
        .from("students")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (studentResult.error) throw studentResult.error;
      if (studentResult.data) {
        waitUntil(
          processPendingPreparationRefreshes({
            studentId: studentResult.data.id,
            limit: 1,
          }).catch((refreshError: unknown) => {
            captureApiError(
              refreshError,
              "/api/ucat/authenticated-visit/background-refresh",
            );
          }),
        );
      }
    }
    return NextResponse.json({
      recorded: visit?.recorded ?? false,
      refreshPending: visit?.refresh_pending ?? false,
      planChanged: visit?.plan_changed ?? false,
    });
  } catch (error) {
    captureApiError(error, "/api/ucat/authenticated-visit");
    return NextResponse.json(
      { error: "Failed to record authenticated UCAT visit." },
      { status: 500 },
    );
  }
}
