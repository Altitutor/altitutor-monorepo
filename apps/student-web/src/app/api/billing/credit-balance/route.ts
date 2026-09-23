import { NextResponse } from "next/server";
import Stripe from "stripe";
import { captureApiError } from "@/lib/sentry/capture-api-error";
import { getServerSupabaseAdmin } from "@/shared/lib/supabase/server";
import { createClient } from "@/shared/lib/supabase/server-ssr";

export const dynamic = "force-dynamic";

const PRIVATE_NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  try {
    const userClient = createClient();
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401, headers: PRIVATE_NO_STORE },
      );
    }

    const [studentCheck, studentIdResult] = await Promise.all([
      userClient.rpc("is_student"),
      userClient.rpc("current_student_id"),
    ]);

    if (studentCheck.error || studentIdResult.error) {
      return NextResponse.json(
        { error: "Could not verify student access" },
        { status: 500, headers: PRIVATE_NO_STORE },
      );
    }

    if (!studentCheck.data || !studentIdResult.data) {
      return NextResponse.json(
        { error: "Student access required" },
        { status: 403, headers: PRIVATE_NO_STORE },
      );
    }

    const admin = getServerSupabaseAdmin();
    const { data: billing, error: billingError } = await admin
      .from("students_billing")
      .select("stripe_customer_id")
      .eq("student_id", studentIdResult.data)
      .maybeSingle();

    if (billingError) {
      throw billingError;
    }

    if (!billing?.stripe_customer_id) {
      return NextResponse.json(
        {
          linked: false,
          balance_cents: 0,
          currency: "aud",
          updated_at: new Date().toISOString(),
        },
        { headers: PRIVATE_NO_STORE },
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      throw new Error("Missing environment variable: STRIPE_SECRET_KEY");
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2025-12-15.clover",
    });
    const customer = await stripe.customers.retrieve(
      billing.stripe_customer_id,
    );

    if (customer.deleted) {
      return NextResponse.json(
        { error: "Billing account is unavailable" },
        { status: 409, headers: PRIVATE_NO_STORE },
      );
    }

    return NextResponse.json(
      {
        linked: true,
        balance_cents: customer.balance ?? 0,
        currency: (customer.currency ?? "aud").toLowerCase(),
        updated_at: new Date().toISOString(),
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error: unknown) {
    captureApiError(error, "/api/billing/credit-balance");
    console.error("[api/billing/credit-balance] Error:", error);
    return NextResponse.json(
      { error: "Failed to load credit balance" },
      { status: 500, headers: PRIVATE_NO_STORE },
    );
  }
}
