import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { clearExamAttemptProgress } from "@/lib/ucat/exam-attempt/service";
import { finalizeExamAttemptOnServer } from "@/lib/ucat/exam-attempt/finalize-attempt";
import type { ExamAttemptKind } from "@/lib/ucat/exam-attempt/types";

export async function POST(request: NextRequest) {
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
      { error: "Server write client not configured" },
      { status: 500 },
    );
  }

  const body = (await request.json()) as {
    kind?: ExamAttemptKind;
    attemptId?: string;
    complete?: boolean;
  };

  if (!body.kind || !body.attemptId || !body.complete) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (studentError) {
    return NextResponse.json({ error: studentError.message }, { status: 500 });
  }
  if (!student) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  await clearExamAttemptProgress(
    supabaseAdmin,
    student.id,
    body.kind,
    body.attemptId,
  );

  const origin = request.nextUrl.origin;
  const cookie = request.headers.get("cookie") ?? "";

  if (body.kind === "set") {
    const res = await fetch(
      `${origin}/api/ucat/set-attempts/${body.attemptId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ complete: true }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error: (data as { error?: string }).error ?? "Failed to finalize set",
        },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  }

  if (body.kind === "mock") {
    const res = await fetch(
      `${origin}/api/ucat/mock-attempts/${body.attemptId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie,
        },
        body: JSON.stringify({ complete: true }),
      },
    );
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        {
          error:
            (data as { error?: string }).error ?? "Failed to finalize mock",
        },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  }

  await finalizeExamAttemptOnServer(
    supabaseAdmin,
    student.id,
    "practice",
    body.attemptId,
  );
  return NextResponse.json({ success: true });
}
