import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import {
  normalizeUcatInvitationCode,
  ucatFounderOfferDescription,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import {
  captureUcatReferral,
  resolveUcatReferralOfferPreview,
} from "@/lib/ucat/referrals/capture-referral";
import {
  findFounderOffer,
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
          !row.stripe_subscription_id &&
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
    const offer = await findFounderOffer(code);
    if (!offer) {
      const referral = await resolveUcatReferralOfferPreview(code);
      if (!referral)
        return NextResponse.json(
          { error: "This invitation or referral code is not available." },
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
    const { count, error } = await supabaseAdmin
      .from("ucat_founder_redemptions")
      .select("id", { count: "exact", head: true })
      .eq("offer_id", offer.id)
      .in("status", ["reserved", "redeemed"]);
    if (error) throw error;
    const unavailable =
      !offer.active ||
      (offer.expires_at && Date.parse(offer.expires_at) <= Date.now());
    const full =
      offer.max_redemptions !== null && (count ?? 0) >= offer.max_redemptions;
    // The owner may still preview/retry a reserved checkout, even after the
    // remaining places are taken or the administrator disables new claims.
    let ownsReservation = false;
    if (unavailable || full) {
      const db = await getSupabaseServerClient();
      const {
        data: { user },
      } = await db.auth.getUser();
      if (user) {
        const { data: student } = await supabaseAdmin
          .from("students")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle();
        if (student) {
          const { data: reservation, error: reservationError } =
            await supabaseAdmin
              .from("ucat_founder_redemptions")
              .select("id")
              .eq("offer_id", offer.id)
              .eq("student_id", student.id)
              .eq("status", "reserved")
              .maybeSingle();
          if (reservationError) throw reservationError;
          ownsReservation = Boolean(reservation);
        }
      }
    }
    if (unavailable && !ownsReservation)
      return NextResponse.json(
        { error: "This invitation has expired or been disabled." },
        { status: 404 },
      );
    if (full && !ownsReservation)
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
            ? "Your selected plan renews automatically after the free period unless cancelled. One free-time founder offer per student; cannot be combined with a previous trial or referral gift."
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
      let sessionId =
        typeof input.checkoutSessionId === "string"
          ? input.checkoutSessionId
          : hold?.checkout_session_id;
      if (hold && !sessionId)
        throw new Error(
          "Checkout is still being prepared. Retry your original selection shortly.",
        );
      // Expiry may have released the hold before older webhook code restored
      // the referral. Recover its session from the gift itself in that case.
      if (!sessionId) {
        const { data: referral, error } = await supabaseAdmin
          .from("ucat_referrals")
          .select("referred_checkout_session_id")
          .eq("referred_student_id", student.id)
          .eq("gift_status", "checkout_pending")
          .maybeSingle();
        if (error) throw error;
        sessionId = referral?.referred_checkout_session_id;
      }
      if (!sessionId) {
        const { data: gift, error } = await supabaseAdmin
          .from("ucat_referral_access_gifts")
          .select("stripe_checkout_session_id")
          .eq("student_id", student.id)
          .eq("status", "checkout_pending")
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        sessionId = gift?.stripe_checkout_session_id;
      }
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
        // A replacement checkout must be able to reselect or replace a referral gift.
        const giftId = session.metadata?.ucat_referral_gift_id;
        if (giftId) {
          const giftKind = session.metadata?.ucat_referral_gift_kind;
          const result =
            giftKind === "earned_referrer"
              ? await supabaseAdmin
                  .from("ucat_referral_access_gifts")
                  .update({
                    status: "available",
                    stripe_checkout_session_id: null,
                  })
                  .eq("id", giftId)
                  .eq("student_id", student.id)
                  .eq("stripe_checkout_session_id", session.id)
                  .eq("status", "checkout_pending")
              : await supabaseAdmin
                  .from("ucat_referrals")
                  .update({
                    gift_status: "pending",
                    referred_checkout_session_id: null,
                  })
                  .eq("id", giftId)
                  .eq("referred_student_id", student.id)
                  .eq("referred_checkout_session_id", session.id)
                  .eq("gift_status", "checkout_pending");
          if (result.error) throw result.error;
        }
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
    const offer = await findFounderOffer(code);
    if (!offer) {
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
    return NextResponse.json(
      {
        error:
          "Choose a plan and apply this code at checkout. A payment card is required.",
      },
      { status: 409 },
    );
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
