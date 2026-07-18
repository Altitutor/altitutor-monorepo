import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";
import { isStripeCancellationFeedback } from "@/features/subscription/lib/subscription-cancellation";

const MAX_COMMENT_LENGTH = 500;

async function getCancellationContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user || !supabaseAdmin) return null;
  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) return null;
  const subscription = await getUcatSubscriptionForStudent(
    supabaseAdmin,
    studentId,
  );
  if (!subscription) return null;
  return { subscription, admin: supabaseAdmin };
}

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2025-12-15.clover" });
}

function cancellationDate(subscription: Stripe.Subscription): string | null {
  const periodEnd = subscription.items.data[0]?.current_period_end ?? null;
  return periodEnd == null ? null : new Date(periodEnd * 1000).toISOString();
}

export async function POST(request: NextRequest) {
  const context = await getCancellationContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (
    context.subscription.status === "past_due" ||
    context.subscription.status === "unpaid"
  ) {
    return NextResponse.json(
      { error: "Resolve your current payment before changing plans." },
      { status: 409 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    feedback?: unknown;
    comment?: unknown;
  } | null;
  const feedback = body?.feedback;
  if (
    feedback !== null &&
    feedback !== undefined &&
    !isStripeCancellationFeedback(feedback)
  ) {
    return NextResponse.json(
      { error: "Invalid cancellation reason" },
      { status: 400 },
    );
  }
  if (
    body?.comment !== null &&
    body?.comment !== undefined &&
    typeof body.comment !== "string"
  ) {
    return NextResponse.json(
      { error: "Invalid cancellation comment" },
      { status: 400 },
    );
  }
  const comment = typeof body?.comment === "string" ? body.comment.trim() : "";
  if (comment.length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      {
        error: `Cancellation comment must be ${MAX_COMMENT_LENGTH} characters or fewer`,
      },
      { status: 400 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }

  try {
    const cancellationDetails = {
      feedback: isStripeCancellationFeedback(feedback) ? feedback : undefined,
      comment: comment || undefined,
    };
    const updated = await stripe.subscriptions.update(
      context.subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
        ...(cancellationDetails.feedback || cancellationDetails.comment
          ? { cancellation_details: cancellationDetails }
          : {}),
      },
    );
    return NextResponse.json({ cancelAt: cancellationDate(updated) });
  } catch (error) {
    captureApiError(error, "/api/ucat/subscription/cancel");
    console.error(
      "[ucat subscription cancellation] Stripe error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to switch to UCAT Free. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  const context = await getCancellationContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }

  try {
    const updated = await stripe.subscriptions.update(
      context.subscription.stripe_subscription_id,
      {
        cancel_at_period_end: false,
        cancellation_details: { feedback: "", comment: "" },
      },
    );
    return NextResponse.json({ cancelAt: cancellationDate(updated) });
  } catch (error) {
    captureApiError(error, "/api/ucat/subscription/cancel");
    console.error(
      "[ucat subscription resume] Stripe error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to keep your paid plan. Please try again." },
      { status: 500 },
    );
  }
}

export async function PUT() {
  const context = await getCancellationContext();
  if (!context) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!context.subscription.cancel_at_period_end) {
    return NextResponse.json(
      { error: "This subscription is not scheduled to switch to UCAT Free." },
      { status: 409 },
    );
  }

  const stripe = getStripe();
  if (!stripe) {
    return NextResponse.json(
      { error: "Billing not configured" },
      { status: 503 },
    );
  }

  try {
    const current = await stripe.subscriptions.retrieve(
      context.subscription.stripe_subscription_id,
    );
    const feedback = current.cancellation_details?.feedback;
    const comment = current.cancellation_details?.comment?.trim();
    const canceled = await stripe.subscriptions.cancel(current.id, {
      invoice_now: false,
      prorate: false,
      ...(isStripeCancellationFeedback(feedback) || comment
        ? {
            cancellation_details: {
              feedback: isStripeCancellationFeedback(feedback)
                ? feedback
                : undefined,
              comment: comment || undefined,
            },
          }
        : {}),
    });

    const canceledAt = canceled.canceled_at
      ? new Date(canceled.canceled_at * 1000).toISOString()
      : new Date().toISOString();
    const { error: syncError } = await context.admin
      .from("student_subscriptions")
      .update({
        status: "canceled",
        cancel_at_period_end: false,
        cancel_at: canceledAt,
        billing_recovery_invoice_id: null,
        billing_recovery_started_at: null,
        billing_recovery_next_attempt_at: null,
        billing_recovery_failure_code: null,
        billing_recovery_requires_action: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", context.subscription.id);

    if (syncError) {
      console.error(
        "[ucat immediate subscription cancellation] Local sync error:",
        syncError.message,
      );
    }

    return NextResponse.json({ cancelAt: canceledAt });
  } catch (error) {
    captureApiError(error, "/api/ucat/subscription/cancel");
    console.error(
      "[ucat immediate subscription cancellation] Stripe error:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to switch to UCAT Free now. Please try again." },
      { status: 500 },
    );
  }
}
