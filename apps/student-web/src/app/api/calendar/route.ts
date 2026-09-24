import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/shared/lib/supabase/server-ssr";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";

export const dynamic = "force-dynamic";

function getStudentBaseUrl(request: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_STUDENT_URL || request.nextUrl.origin
  ).replace(/\/$/, "");
}

/** Provision (or return) the authenticated student's private calendar URL. */
export async function POST(request: NextRequest) {
  const userClient = createUserClient();
  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    { data: isStudent, error: studentCheckError },
    { data: studentId, error: studentIdError },
  ] = await Promise.all([
    userClient.rpc("is_student"),
    userClient.rpc("current_student_id"),
  ]);

  if (studentCheckError || studentIdError) {
    return NextResponse.json(
      { error: "Could not verify student access" },
      { status: 500 },
    );
  }

  if (!isStudent || !studentId) {
    return NextResponse.json(
      { error: "Student access required" },
      { status: 403 },
    );
  }

  const admin = getServerSupabaseAdmin();
  const { data: subscription, error: subscriptionError } = await admin
    .from("student_calendar_subscriptions")
    .upsert({ student_id: studentId }, { onConflict: "student_id" })
    .select("token")
    .single();

  if (subscriptionError || !subscription) {
    console.error(
      "Failed to provision student calendar subscription:",
      subscriptionError,
    );
    return NextResponse.json(
      { error: "Could not create calendar subscription" },
      { status: 500 },
    );
  }

  const subscriptionUrl = new URL(
    `/api/calendar/${subscription.token}`,
    getStudentBaseUrl(request),
  ).toString();

  return NextResponse.json(
    { subscriptionUrl },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
