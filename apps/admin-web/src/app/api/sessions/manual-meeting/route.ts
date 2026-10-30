import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";
import { manualMeetingSchema } from "@/features/bookings/api/admin-meetings";
import { captureApiError } from "@/lib/sentry/capture-api-error";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: staff } = await supabase
      .from("staff")
      .select("id,role,status")
      .eq("user_id", user.id)
      .single();
    if (staff?.role !== "ADMINSTAFF" || staff.status !== "ACTIVE")
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      );
    const parsed = manualMeetingSchema.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message ?? "Invalid meeting" },
        { status: 400 },
      );
    const input = parsed.data;
    const { data: sessionId, error: bookingError } = await supabase.rpc(
      "create_admin_meeting",
      {
        p_type: input.type,
        p_start_at: input.startAt,
        p_end_at: input.endAt,
        p_student_ids: input.studentIds,
        p_parent_ids: input.parentIds,
        p_staff_ids: input.staffIds,
        p_receiver_staff_ids: input.receiverStaffIds,
        p_subject_id: input.subjectId ?? undefined,
        p_original_session_id: input.originalSessionId ?? undefined,
      },
    );
    if (bookingError) throw bookingError;
    return NextResponse.json({ sessionId });
  } catch (error) {
    captureApiError(error, "/api/sessions/manual-meeting");
    return NextResponse.json(
      { error: "Could not book meeting. Please try again." },
      { status: 500 },
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const input = manualMeetingSchema.parse(
      JSON.parse(request.nextUrl.searchParams.get("input") ?? "{}"),
    );
    const { data, error } = await supabase.rpc("admin_meeting_warnings", {
      p_type: input.type,
      p_start_at: input.startAt,
      p_end_at: input.endAt,
      p_staff_ids: input.staffIds,
      p_subject_id: input.subjectId ?? undefined,
      p_original_session_id: input.originalSessionId ?? undefined,
    });
    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json(
      { error: "Availability could not be checked" },
      { status: 400 },
    );
  }
}
