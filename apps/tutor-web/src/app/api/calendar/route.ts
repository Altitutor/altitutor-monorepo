import { NextRequest, NextResponse } from "next/server";
import { createClient as createUserClient } from "@/shared/lib/supabase/server-ssr";
import { getServiceRoleClient } from "@/shared/lib/supabase/service-role";

export const dynamic = "force-dynamic";

function getTutorBaseUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_TUTOR_URL || request.nextUrl.origin).replace(
    /\/$/,
    "",
  );
}

/** Provision (or return) the authenticated tutor's private calendar URL. */
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
    { data: isTutor, error: tutorCheckError },
    { data: staffId, error: staffError },
  ] = await Promise.all([
    userClient.rpc("is_tutor"),
    userClient.rpc("current_tutor_id"),
  ]);

  if (tutorCheckError || staffError) {
    return NextResponse.json(
      { error: "Could not verify tutor access" },
      { status: 500 },
    );
  }

  if (!isTutor || !staffId) {
    return NextResponse.json(
      { error: "Tutor access required" },
      { status: 403 },
    );
  }

  const admin = getServiceRoleClient();
  const { data: subscription, error: subscriptionError } = await admin
    .from("tutor_calendar_subscriptions")
    .upsert({ staff_id: staffId }, { onConflict: "staff_id" })
    .select("token")
    .single();

  if (subscriptionError || !subscription) {
    console.error(
      "Failed to provision tutor calendar subscription:",
      subscriptionError,
    );
    return NextResponse.json(
      { error: "Could not create calendar subscription" },
      { status: 500 },
    );
  }

  const subscriptionUrl = new URL(
    `/api/calendar/${subscription.token}`,
    getTutorBaseUrl(request),
  ).toString();

  return NextResponse.json(
    { subscriptionUrl },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
