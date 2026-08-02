import { NextRequest, NextResponse } from "next/server";
import { requireAdminStaff } from "@/features/pay-tiers/server/requireAdminStaff";

const CAMPAIGNS = new Set([
  "onboarding_starting_point",
  "onboarding_technique",
  "onboarding_timing",
  "onboarding_plan",
  "first_score_estimate",
  "weekly_review",
  "gentle_restart",
  "upgrade_quota",
  "upgrade_consistency",
  "referral_invitation",
]);
const FAMILIARITIES = new Set(["new", "familiar", "experienced"]);

export async function GET(request: NextRequest) {
  const auth = await requireAdminStaff();
  if (!auth.ok) return auth.response;
  const campaign = request.nextUrl.searchParams.get("campaign");
  const familiarity = request.nextUrl.searchParams.get("familiarity") || "new";
  if (
    !campaign ||
    !CAMPAIGNS.has(campaign) ||
    !FAMILIARITIES.has(familiarity)
  ) {
    return NextResponse.json({ error: "Invalid preview" }, { status: 400 });
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secret = process.env.UCAT_LIFECYCLE_CRON_SECRET_KEY;
  if (!url || !secret) {
    return NextResponse.json(
      { error: "Lifecycle function is not configured" },
      { status: 500 },
    );
  }
  const result = await fetch(url + "/functions/v1/ucat-lifecycle-emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + secret,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ mode: "preview", campaign, familiarity }),
    cache: "no-store",
  });
  return new NextResponse(await result.text(), {
    status: result.status,
    headers: {
      "Content-Type":
        result.headers.get("content-type") || "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
