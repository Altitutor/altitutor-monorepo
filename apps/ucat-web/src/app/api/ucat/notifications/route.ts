import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const MAX_NOTIFICATIONS = 50;

async function resolveStudentId(): Promise<
  { studentId: string } | { response: NextResponse }
> {
  if (!supabaseAdmin) {
    return {
      response: NextResponse.json(
        { error: "Server not configured" },
        { status: 500 },
      ),
    };
  }

  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const { data: student, error } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return {
      response: NextResponse.json(
        { error: "Failed to resolve student" },
        { status: 500 },
      ),
    };
  }
  if (!student) {
    return {
      response: NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      ),
    };
  }

  return { studentId: student.id };
}

export async function GET() {
  const resolved = await resolveStudentId();
  if ("response" in resolved) return resolved.response;

  const now = new Date().toISOString();
  const [{ data, error }, { count, error: countError }] = await Promise.all([
    supabaseAdmin!
      .from("notifications")
      .select(
        "id, notification_type, title, body, read_at, action_url, metadata, priority, expires_at, resolved_at, created_at",
      )
      .eq("student_id", resolved.studentId)
      .eq("app_scope", "ucat_web")
      .is("resolved_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(MAX_NOTIFICATIONS),
    supabaseAdmin!
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("student_id", resolved.studentId)
      .eq("app_scope", "ucat_web")
      .is("read_at", null)
      .is("resolved_at", null)
      .or(`expires_at.is.null,expires_at.gt.${now}`),
  ]);

  if (error || countError) {
    console.error("[ucat notifications] Failed to load inbox", {
      error,
      countError,
    });
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    notifications: data ?? [],
    unreadCount: count ?? 0,
  });
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveStudentId();
  if ("response" in resolved) return resolved.response;

  let body: { notificationIds?: string[]; markAllRead?: boolean };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const ids = Array.from(
    new Set(
      (body.notificationIds ?? []).filter((id) => typeof id === "string"),
    ),
  ).slice(0, MAX_NOTIFICATIONS);

  if (!body.markAllRead && ids.length === 0) {
    return NextResponse.json(
      { error: "No notifications selected" },
      { status: 400 },
    );
  }

  let update = supabaseAdmin!
    .from("notifications")
    .update({
      read_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("student_id", resolved.studentId)
    .eq("app_scope", "ucat_web")
    .is("read_at", null);

  if (!body.markAllRead) {
    update = update.in("id", ids);
  }

  const { error } = await update;
  if (error) {
    console.error("[ucat notifications] Failed to mark inbox read", error);
    return NextResponse.json(
      { error: "Failed to update notifications" },
      { status: 500 },
    );
  }

  return NextResponse.json({ success: true });
}
