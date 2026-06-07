import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";
import { getPracticeDiscountDashboardStatus } from "@/lib/ucat/practice-day-discount-dashboard";

/**
 * GET /api/ucat/subscription/practice-discount-progress
 * Practice-day discount dashboard: today progress, last 7 days, invoice total.
 */
export async function GET() {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: "Server not configured" }, { status: 503 });
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 });
  }

  const status = await getPracticeDiscountDashboardStatus(
    supabaseAdmin,
    studentId,
  );

  return NextResponse.json(status);
}
