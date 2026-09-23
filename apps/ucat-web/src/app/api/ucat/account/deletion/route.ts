import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  BillingUnavailableError,
  deleteUcatProductAccount,
  type DeleteUcatProductAccountResult,
} from "@/features/account-deletion/delete-ucat-product-account";
import { createProductAccountDeletionStore } from "@/features/account-deletion/server/product-account-deletion-store";

const ROUTE = "/api/ucat/account/deletion";

function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2025-12-15.clover" });
}

async function cancelStripeSubscription(stripeSubscriptionId: string) {
  const stripe = getStripe();
  if (!stripe) throw new BillingUnavailableError();
  const current = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  if (current.status === "canceled") return;
  await stripe.subscriptions.cancel(stripeSubscriptionId, {
    invoice_now: false,
    prorate: false,
  });
}

function failureResponse(
  result: Extract<DeleteUcatProductAccountResult, { ok: false }>,
) {
  switch (result.error) {
    case "not_found":
      return NextResponse.json({ error: "Account not found" }, { status: 404 });
    case "name_mismatch":
      return NextResponse.json(
        { error: "Type your full name as it appears on your profile." },
        { status: 400 },
      );
    case "billing_unavailable":
      return NextResponse.json(
        { error: "Billing is unavailable. Try again shortly." },
        { status: 503 },
      );
    case "billing_failed":
      return NextResponse.json(
        {
          error:
            "We couldn't cancel your subscription, so your account was not deleted.",
        },
        { status: 502 },
      );
    case "deletion_failed":
      return NextResponse.json(
        { error: "We couldn't finish deleting your UCAT account. Try again." },
        { status: 500 },
      );
  }
}

export async function POST(request: NextRequest) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: "Account deletion is unavailable." },
      { status: 503 },
    );
  }
  const admin = supabaseAdmin;

  const body = (await request.json().catch(() => null)) as {
    fullName?: unknown;
  } | null;
  if (!body || typeof body.fullName !== "string" || !body.fullName.trim()) {
    return NextResponse.json(
      { error: "Type your full name to confirm." },
      { status: 400 },
    );
  }

  try {
    const result = await deleteUcatProductAccount({
      userId: user.id,
      fullName: body.fullName,
      store: createProductAccountDeletionStore(admin),
      cancelStripeSubscription,
      deleteAuthUser: async (userId) => {
        const { error } = await admin.auth.admin.deleteUser(userId);
        if (error) throw error;
      },
    });
    if (!result.ok) return failureResponse(result);
    return NextResponse.json({ loginRemoved: result.loginRemoved });
  } catch (error) {
    captureApiError(error, ROUTE);
    return NextResponse.json(
      { error: "We couldn't finish deleting your UCAT account. Try again." },
      { status: 500 },
    );
  }
}
