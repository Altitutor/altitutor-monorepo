import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

type AdminClient = SupabaseClient<Database>;

type AuthFailure = { ok: false; response: NextResponse };

export async function requireUserAdminClient(): Promise<
  | {
      ok: true;
      userId: string;
      admin: AdminClient;
    }
  | AuthFailure
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to get user" },
        { status: 500 },
      ),
    };
  }
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!supabaseAdmin) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Server write client not configured" },
        { status: 500 },
      ),
    };
  }

  return {
    ok: true,
    userId: user.id,
    admin: supabaseAdmin,
  };
}

export async function requireStudentAdminClient(): Promise<
  | {
      ok: true;
      userId: string;
      studentId: string;
      timezone: string;
      admin: AdminClient;
    }
  | AuthFailure
> {
  const auth = await requireUserAdminClient();
  if (!auth.ok) return auth;

  const { data: student, error: studentError } = await auth.admin
    .from("students")
    .select("id, timezone")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (studentError) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "Failed to resolve student" },
        { status: 500 },
      ),
    };
  }
  if (!student) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: "No student profile found" },
        { status: 404 },
      ),
    };
  }

  return {
    ok: true,
    userId: auth.userId,
    studentId: student.id,
    timezone: student.timezone ?? "Australia/Adelaide",
    admin: auth.admin,
  };
}
