import { captureApiError } from "@/lib/sentry/capture-api-error";
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  getStudentIdForUser,
  getUcatSubscriptionForStudent,
} from "@/lib/ucat/ucat-subscription";

type PaymentMethodContext = {
  stripe: Stripe;
  studentId: string;
  customerId: string;
  subscriptionId: string;
};

function stripeClient(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return null;
  return new Stripe(secretKey, { apiVersion: "2025-12-15.clover" });
}

function customerIdFromStripeCustomer(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer,
): string {
  return typeof customer === "string" ? customer : customer.id;
}

function paymentMethodId(
  paymentMethod: string | Stripe.PaymentMethod | null,
): string | null {
  if (!paymentMethod) return null;
  return typeof paymentMethod === "string" ? paymentMethod : paymentMethod.id;
}

function safeCardSummary(paymentMethod: Stripe.PaymentMethod | null) {
  const card = paymentMethod?.card;
  if (!paymentMethod || paymentMethod.type !== "card" || !card) return null;

  return {
    brand: card.brand,
    last4: card.last4,
    expMonth: card.exp_month,
    expYear: card.exp_year,
  };
}

async function resolveContext(): Promise<
  | { context: PaymentMethodContext }
  | { response: NextResponse }
> {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    return {
      response: NextResponse.json(
        { error: "Failed to get user" },
        { status: 500 },
      ),
    };
  }
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!supabaseAdmin) {
    return {
      response: NextResponse.json(
        { error: "Server not configured" },
        { status: 503 },
      ),
    };
  }

  const stripe = stripeClient();
  if (!stripe) {
    return {
      response: NextResponse.json(
        { error: "Billing not configured" },
        { status: 503 },
      ),
    };
  }

  const studentId = await getStudentIdForUser(supabaseAdmin, user.id);
  if (!studentId) {
    return {
      response: NextResponse.json(
        { error: "No student profile found" },
        { status: 404 },
      ),
    };
  }

  const [{ data: billing, error: billingError }, subscription] =
    await Promise.all([
      supabaseAdmin
        .from("students_billing")
        .select("stripe_customer_id")
        .eq("student_id", studentId)
        .maybeSingle(),
      getUcatSubscriptionForStudent(supabaseAdmin, studentId),
    ]);

  if (billingError) {
    return {
      response: NextResponse.json(
        { error: "Failed to load billing profile" },
        { status: 500 },
      ),
    };
  }
  if (!billing?.stripe_customer_id) {
    return {
      response: NextResponse.json(
        { error: "No Stripe customer found" },
        { status: 404 },
      ),
    };
  }
  if (!subscription?.stripe_subscription_id) {
    return {
      response: NextResponse.json(
        { error: "No manageable UCAT subscription found" },
        { status: 404 },
      ),
    };
  }

  return {
    context: {
      stripe,
      studentId,
      customerId: billing.stripe_customer_id,
      subscriptionId: subscription.stripe_subscription_id,
    },
  };
}

async function retrieveSubscription(
  context: PaymentMethodContext,
): Promise<Stripe.Subscription> {
  const subscription = await context.stripe.subscriptions.retrieve(
    context.subscriptionId,
    { expand: ["default_payment_method"] },
  );
  if (customerIdFromStripeCustomer(subscription.customer) !== context.customerId) {
    throw new Error("UCAT subscription customer mismatch");
  }
  return subscription;
}

export async function GET() {
  const resolved = await resolveContext();
  if ("response" in resolved) return resolved.response;

  try {
    const { context } = resolved;
    const subscription = await retrieveSubscription(context);
    let id = paymentMethodId(subscription.default_payment_method);

    if (!id) {
      const customer = await context.stripe.customers.retrieve(
        context.customerId,
        { expand: ["invoice_settings.default_payment_method"] },
      );
      if (!customer.deleted) {
        id = paymentMethodId(customer.invoice_settings.default_payment_method);
      }
    }

    const method = id
      ? await context.stripe.paymentMethods.retrieve(id)
      : null;

    return NextResponse.json({ paymentMethod: safeCardSummary(method) });
  } catch (error: unknown) {
    captureApiError(error, "/api/ucat/payment-method");
    console.error(
      "[ucat payment method] Failed to retrieve payment method:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to load payment method" },
      { status: 500 },
    );
  }
}

export async function POST() {
  const resolved = await resolveContext();
  if ("response" in resolved) return resolved.response;

  try {
    const { context } = resolved;
    await retrieveSubscription(context);
    const setupIntent = await context.stripe.setupIntents.create({
      customer: context.customerId,
      payment_method_types: ["card"],
      usage: "off_session",
      metadata: {
        student_id: context.studentId,
        ucat_subscription_id: context.subscriptionId,
        purpose: "ucat_subscription_payment_method_update",
      },
    });

    if (!setupIntent.client_secret) {
      throw new Error("SetupIntent did not include a client secret");
    }

    return NextResponse.json({ clientSecret: setupIntent.client_secret });
  } catch (error: unknown) {
    captureApiError(error, "/api/ucat/payment-method");
    console.error(
      "[ucat payment method] Failed to create SetupIntent:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to prepare card update" },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  const resolved = await resolveContext();
  if ("response" in resolved) return resolved.response;

  let body: { setupIntentId?: unknown };
  try {
    body = (await request.json()) as { setupIntentId?: unknown };
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (
    typeof body.setupIntentId !== "string" ||
    !body.setupIntentId.startsWith("seti_")
  ) {
    return NextResponse.json(
      { error: "A valid SetupIntent is required" },
      { status: 400 },
    );
  }

  try {
    const { context } = resolved;
    await retrieveSubscription(context);
    const setupIntent = await context.stripe.setupIntents.retrieve(
      body.setupIntentId,
      { expand: ["payment_method"] },
    );
    const setupCustomerId = setupIntent.customer
      ? customerIdFromStripeCustomer(setupIntent.customer)
      : null;
    const method =
      setupIntent.payment_method &&
      typeof setupIntent.payment_method !== "string"
        ? setupIntent.payment_method
        : null;
    const metadata = setupIntent.metadata ?? {};

    if (
      setupIntent.status !== "succeeded" ||
      setupCustomerId !== context.customerId ||
      metadata.student_id !== context.studentId ||
      metadata.ucat_subscription_id !== context.subscriptionId ||
      metadata.purpose !== "ucat_subscription_payment_method_update" ||
      !method ||
      method.type !== "card"
    ) {
      return NextResponse.json(
        { error: "The card update could not be verified" },
        { status: 409 },
      );
    }

    await context.stripe.subscriptions.update(context.subscriptionId, {
      default_payment_method: method.id,
    });

    return NextResponse.json({ paymentMethod: safeCardSummary(method) });
  } catch (error: unknown) {
    captureApiError(error, "/api/ucat/payment-method");
    console.error(
      "[ucat payment method] Failed to apply payment method:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to update payment method" },
      { status: 500 },
    );
  }
}
