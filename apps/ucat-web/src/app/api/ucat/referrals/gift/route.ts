import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";

async function authenticatedStudentId(): Promise<
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
  } = await supabase.auth.getUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return {
      response: NextResponse.json(
        { error: "Student profile not found" },
        { status: 404 },
      ),
    };
  }
  return { studentId };
}

export async function GET() {
  const authenticated = await authenticatedStudentId();
  if ("response" in authenticated) return authenticated.response;

  await supabaseAdmin!.rpc("expire_ucat_referral_gifts");
  const [{ data: pendingGift, error }, { data: earnedGifts }] =
    await Promise.all([
      supabaseAdmin!
        .from("ucat_referrals")
        .select(
          "id, gift_duration_interval, gift_expires_at, gift_status, referrer:students!ucat_referrals_referrer_student_id_fkey(first_name, last_name)",
        )
        .eq("referred_student_id", authenticated.studentId)
        .in("gift_status", ["pending", "checkout_pending"])
        .gt("gift_expires_at", new Date().toISOString())
        .maybeSingle(),
      supabaseAdmin!
        .from("ucat_referral_access_gifts")
        .select("id, duration_interval, status, created_at")
        .eq("student_id", authenticated.studentId)
        .in("status", ["available", "checkout_pending"])
        .order("created_at", { ascending: true }),
    ]);

  if (error) {
    console.error("[ucat referral gift] Failed to load gift", error);
    captureApiError(error, "/api/ucat/referrals/gift");
    return NextResponse.json(
      { error: "Failed to load referral gift" },
      { status: 500 },
    );
  }

  const referrer = pendingGift?.referrer;
  const referrerName = referrer
    ? [referrer.first_name, referrer.last_name].filter(Boolean).join(" ")
    : null;

  return NextResponse.json({
    pendingGift: pendingGift
      ? {
          id: pendingGift.id,
          duration: pendingGift.gift_duration_interval,
          expiresAt: pendingGift.gift_expires_at,
          referrerName: referrerName || "A friend",
        }
      : null,
    earnedGifts: earnedGifts ?? [],
  });
}

export async function POST(request: NextRequest) {
  const authenticated = await authenticatedStudentId();
  if ("response" in authenticated) return authenticated.response;

  let body: { action?: unknown; referralId?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (body.action !== "reject" || typeof body.referralId !== "string") {
    return NextResponse.json({ error: "Invalid gift action" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin!.rpc(
    "reject_ucat_referral_gift",
    {
      p_referral_id: body.referralId,
      p_referred_student_id: authenticated.studentId,
    },
  );
  if (error) {
    console.error("[ucat referral gift] Failed to reject gift", error);
    captureApiError(error, "/api/ucat/referrals/gift");
    return NextResponse.json(
      { error: "Failed to reject referral gift" },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "This referral gift is no longer available" },
      { status: 409 },
    );
  }
  return NextResponse.json({ success: true });
}
