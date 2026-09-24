import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getStudentIdForUser } from "@/lib/ucat/ucat-subscription";

const PORTAL_ACTIONS = [
  "payment_method_update",
  "subscription_update",
] as const;

type PortalAction = (typeof PORTAL_ACTIONS)[number];

function isPortalAction(value: unknown): value is PortalAction {
  return PORTAL_ACTIONS.includes(value as PortalAction);
}

/**
 * POST /api/ucat/billing-portal
 * Creates a focused Stripe Customer Portal flow for one billing action.
 */
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
      { error: "Server not configured" },
      { status: 500 },
    );
  }

  let body: { action?: unknown } = {};
  try {
    body = (await request.json()) as { action?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  if (!isPortalAction(body.action)) {
    return NextResponse.json(
      { error: "Invalid billing action" },
      { status: 400 },
    );
  }

  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json(
      { error: "Billing not configured. Please contact support." },
      { status: 503 },
    );
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return NextResponse.json(
      { error: "No student profile found" },
      { status: 404 },
    );
  }

  const [{ data: billing, error: billingError }, { data: subscription }] =
    await Promise.all([
      supabaseAdmin
        .from("students_billing")
        .select("stripe_customer_id")
        .eq("student_id", studentId)
        .maybeSingle(),
      supabaseAdmin
        .from("student_subscriptions")
        .select("stripe_subscription_id")
        .eq("student_id", studentId)
        .in("status", ["active", "trialing", "past_due"])
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (billingError) {
    return NextResponse.json(
      { error: "Failed to load billing profile" },
      { status: 500 },
    );
  }

  if (!billing?.stripe_customer_id) {
    return NextResponse.json(
      { error: "No Stripe customer found for your account" },
      { status: 404 },
    );
  }

  if (
    body.action !== "payment_method_update" &&
    !subscription?.stripe_subscription_id
  ) {
    return NextResponse.json(
      { error: "No manageable subscription found" },
      { status: 404 },
    );
  }

  const stripe = new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });

  const origin = request.nextUrl.origin;

  try {
    const returnUrl = `${origin}/settings/plan/subscription`;
    const flowData: Stripe.BillingPortal.SessionCreateParams.FlowData =
      body.action === "payment_method_update"
        ? {
            type: "payment_method_update",
            after_completion: {
              type: "redirect",
              redirect: { return_url: returnUrl },
            },
          }
        : {
            type: "subscription_update",
            subscription_update: {
              subscription: subscription!.stripe_subscription_id,
            },
            after_completion: {
              type: "redirect",
              redirect: { return_url: returnUrl },
            },
          };

    const session = await stripe.billingPortal.sessions.create({
      customer: billing.stripe_customer_id,
      return_url: returnUrl,
      flow_data: flowData,
    });

    if (!session.url) {
      return NextResponse.json(
        { error: "Failed to create billing portal session" },
        { status: 500 },
      );
    }

    return NextResponse.json({ url: session.url });
  } catch (err) {
    captureApiError(err, "/api/ucat/billing-portal");
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ucat billing-portal] Stripe error:", msg);
    return NextResponse.json(
      { error: "Failed to open billing portal" },
      { status: 500 },
    );
  }
}
