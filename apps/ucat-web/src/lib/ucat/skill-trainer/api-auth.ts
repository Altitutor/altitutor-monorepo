import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = SupabaseClient<Database>;

export async function requireStudentAdminClient(): Promise<
  | { ok: true; studentId: string; timezone: string; admin: AdminClient }
  | { ok: false; response: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Failed to get user" }, { status: 500 }),
    };
  }
  if (!user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Server write client not configured" }, { status: 500 }),
    };
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, timezone")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Failed to resolve student" }, { status: 500 }),
    };
  }
  if (!student) {
    return {
      ok: false,
      response: NextResponse.json({ error: "No student profile found" }, { status: 404 }),
    };
  }

  return {
    ok: true,
    studentId: student.id,
    timezone: student.timezone ?? "Australia/Adelaide",
    admin: supabaseAdmin,
  };
}
