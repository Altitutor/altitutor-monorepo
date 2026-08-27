import { NextResponse } from "next/server";
import { captureApiError } from "@/lib/sentry/capture-api-error";
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
    return NextResponse.json({
      recorded: visit?.recorded ?? false,
      refreshPending: visit?.refresh_pending ?? false,
    });
  } catch (error) {
    captureApiError(error, "/api/ucat/authenticated-visit");
    return NextResponse.json(
      { error: "Failed to record authenticated UCAT visit." },
      { status: 500 },
    );
  }
}
