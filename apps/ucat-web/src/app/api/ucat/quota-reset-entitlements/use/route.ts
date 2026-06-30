import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST() {
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

  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json(
      { error: "Failed to resolve student" },
      { status: 500 },
    );
  }

  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const { data: usedEntitlementId, error: useError } = await supabaseAdmin.rpc(
    "use_ucat_free_quota_reset_entitlement",
    { p_student_id: student.id },
  );

  if (useError) {
    return NextResponse.json(
      { error: "Failed to use quota reset entitlement" },
      { status: 500 },
    );
  }

  if (!usedEntitlementId) {
    return NextResponse.json(
      { error: "No available quota reset entitlement" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
