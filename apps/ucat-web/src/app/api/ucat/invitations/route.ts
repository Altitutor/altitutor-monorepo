import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  normalizeUcatInvitationCode,
  ucatFounderOfferDescription,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { captureUcatOfferEventInBackground } from "@/lib/analytics/posthog-server";
import {
  captureUcatReferral,
  resolveUcatReferralOfferPreview,
} from "@/lib/ucat/referrals/capture-referral";
import {
  findFounderOffer,
  claimFounderOffer,
  founderHistory,
  cancelFounderCheckout,
} from "@/lib/ucat/founder-offers/server";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("status") === "mine") {
    const db = await getSupabaseServerClient();
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user || !supabaseAdmin)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const { data: student } = await supabaseAdmin
      .from("students")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!student) return NextResponse.json({ accessEndsAt: null });
    try {
      const history = await founderHistory(student.id);
      const pass = history.find(
        (row) =>
          row.kind === "access_pass" &&
          row.access_ends_at &&
          Date.parse(row.access_ends_at) > Date.now(),
      );
      return NextResponse.json(
        { accessEndsAt: pass?.access_ends_at ?? null },
        { headers: { "Cache-Control": "no-store" } },
      );
    } catch {
      return NextResponse.json(
        { error: "Could not load access status." },
        { status: 503 },
      );
    }
  }
  const code = normalizeUcatInvitationCode(
    request.nextUrl.searchParams.get("code"),
  );
  if (!code || !supabaseAdmin)
    return NextResponse.json(
      { error: "Enter a valid invitation or referral code." },
      { status: 400 },
    );
  try {
    if (!code.startsWith("F-")) {
      const referral = await resolveUcatReferralOfferPreview(code);
      if (!referral)
        return NextResponse.json(
          { error: "This referral code is not available." },
          { status: 404 },
        );
      return NextResponse.json(
        {
          code,
          kind: "referral",
          name: `A gift from ${referral.referrerName}`,
          description: `Your first ${referral.duration} of UCAT Unlimited free`,
          terms:
            "Requires a payment card. Your subscription renews automatically after the free period unless cancelled.",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    const offer = await findFounderOffer(code);
    if (
      !offer ||
      !offer.active ||
      (offer.expires_at && Date.parse(offer.expires_at) <= Date.now())
    )
      return NextResponse.json(
        { error: "This invitation has expired or been disabled." },
        { status: 404 },
      );
    const { count, error } = await supabaseAdmin
      .from("ucat_founder_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offer.id)
      .in("status", ["reserved", "redeemed"]);
    if (error) throw error;
    if (offer.max_redemptions !== null && (count ?? 0) >= offer.max_redemptions)
      return NextResponse.json(
        { error: "All places for this invitation are currently claimed." },
        { status: 409 },
      );
    return NextResponse.json(
      {
        id: offer.id,
        code: offer.code,
        campaign: offer.campaign,
        kind: offer.kind,
        name: offer.name,
        percentOff: offer.percent_off,
        description: ucatFounderOfferDescription(offer),
        terms:
          offer.kind === "access_pass"
            ? "No card required. Starts when you accept. No automatic renewal; choose a paid subscription afterwards. One access pass per student; cannot be combined with a previous trial or referral gift."
            : "For a new weekly, monthly or yearly Unlimited subscription. Applies to the current plan price and ends when your subscription ends. No other promotional offers; earned practice and referral rewards remain available.",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    captureApiError(error, "/api/ucat/invitations");
    return NextResponse.json(
      { error: "Could not load this invitation. Please try again." },
      { status: 503 },
    );
  }
}

export async function POST(request: NextRequest) {
  const db = await getSupabaseServerClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user)
    return NextResponse.json(
      { error: "Please sign in to redeem your invitation." },
      { status: 401 },
    );
  if (!supabaseAdmin)
    return NextResponse.json(
      { error: "Server not configured" },
      { status: 503 },
    );
  const body: unknown = await request.json().catch(() => null);
  const input =
    body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id, account_class")
    .eq("user_id", user.id)
    .maybeSingle();
  if (studentError || !student)
    return NextResponse.json(
      { error: "Complete your student profile first." },
      { status: 409 },
    );
  try {
    const history = await founderHistory(student.id);
    if (input.action === "cancel_checkout") {
      const { data: hold, error: holdError } = await supabaseAdmin
        .from("ucat_checkout_holds")
        .select("*")
        .eq("student_id", student.id)
        .maybeSingle();
      if (holdError) throw holdError;
      const sessionId =
        typeof input.checkoutSessionId === "string"
          ? input.checkoutSessionId
          : hold?.checkout_session_id;
      if (hold && !sessionId)
        throw new Error(
          "Checkout is still being prepared. Retry your original selection shortly.",
        );
      if (sessionId) {
        if (!process.env.STRIPE_SECRET_KEY)
          throw new Error("Billing is temporarily unavailable.");
        const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
          apiVersion: "2025-12-15.clover",
        });
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.metadata?.student_id !== student.id)
          throw new Error("This checkout does not belong to your account.");
        if (session.status === "complete")
          throw new Error("Your purchase is being confirmed.");
        if (session.status === "open")
          await stripe.checkout.sessions.expire(session.id);
        let release = supabaseAdmin
          .from("ucat_checkout_holds")
          .delete()
          .eq("student_id", student.id);
        release = session.metadata?.ucat_checkout_hold_id
          ? release.eq("id", session.metadata.ucat_checkout_hold_id)
          : release.eq("checkout_session_id", session.id);
        const { error: releaseError } = await release;
        if (releaseError) throw releaseError;
      }
      const pending = history.find((r) => r.status === "reserved");
      if (pending) {
        if (!process.env.STRIPE_SECRET_KEY)
          throw new Error("Billing is temporarily unavailable.");
        await cancelFounderCheckout(
          new Stripe(process.env.STRIPE_SECRET_KEY, {
            apiVersion: "2025-12-15.clover",
          }),
          pending,
        );
      }
      return NextResponse.json({ cancelled: true });
    }
    const code = normalizeUcatInvitationCode(input.code);
    if (!code)
      return NextResponse.json(
        { error: "Enter a valid code." },
        { status: 400 },
      );
    if (!code.startsWith("F-")) {
      if (history.some((r) => r.kind === "access_pass"))
        throw new Error(
          "A referral gift cannot be combined with your founder access pass.",
        );
      await captureUcatReferral(student.id, code);
      const { data: referral, error } = await supabaseAdmin
        .from("ucat_referrals")
        .select(
          "id, gift_duration_interval, gift_status, gift_expires_at, ucat_referral_codes(code)",
        )
        .eq("referred_student_id", student.id)
        .maybeSingle();
      if (error) throw error;
      if (
        !referral ||
        referral.ucat_referral_codes?.code !== code ||
        !["pending", "checkout_pending"].includes(referral.gift_status) ||
        Date.parse(referral.gift_expires_at) <= Date.now()
      )
        throw new Error("This referral gift is not available to your account.");
      return NextResponse.json({
        kind: "referral",
        giftId: referral.id,
        interval: referral.gift_duration_interval,
      });
    }
    const offer = await findFounderOffer(code);
    if (!offer || offer.kind !== "access_pass")
      throw new Error("Choose a paid plan to use a founder discount.");
    const claim = await claimFounderOffer(student.id, code);
    captureUcatOfferEventInBackground({
      authUserId: user.id,
      event: "founder_offer_redeemed",
      dedupeKey: `founder-offer:${claim.id}`,
      properties: {
        student_id: student.id,
        account_class: student.account_class,
        offer_id: offer.id,
        offer_code: offer.code,
        offer_campaign: offer.campaign,
        offer_kind: offer.kind,
        redemption_id: claim.id,
        access_ends_at: claim.access_ends_at,
      },
    });
    return NextResponse.json({
      kind: "access_pass",
      accessEndsAt: claim.access_ends_at,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not redeem this invitation.",
      },
      { status: 409 },
    );
  }
}
