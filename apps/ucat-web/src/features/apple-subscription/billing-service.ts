import {
  UCAT_APPLE_PRODUCTS,
  type UcatAppleBillingState,
} from "@altitutor/shared";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getUcatSubjectId } from "@/lib/ucat/ucat-subject-id";
import {
  appleBillingConfigured,
  createAppleClient,
  sandboxAccountAllowed,
} from "./apple-config";
import {
  createAppleVerifier,
  readAppleSubscription,
  type AppleEnvironment,
} from "./apple-gateway";

export class AppleBillingError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function appleBillingContext() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) throw new AppleBillingError("Sign in to continue.", 401);
  if (!supabaseAdmin)
    throw new AppleBillingError("Billing is unavailable.", 503);
  const { data: student, error: studentError } = await supabaseAdmin
    .from("students")
    .select("id,ucat_online_tier_override")
    .eq("user_id", user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (studentError) throw new AppleBillingError("Unable to load account.", 503);
  if (!student)
    throw new AppleBillingError("Student account unavailable.", 403);
  const { data: relationship, error: relationshipError } = await supabaseAdmin
    .from("student_online_product_relationships")
    .select("id")
    .eq("student_id", student.id)
    .eq("product", "UCAT_WEB")
    .is("closed_at", null)
    .maybeSingle();
  if (relationshipError)
    throw new AppleBillingError("Unable to load account.", 503);
  if (!relationship)
    throw new AppleBillingError("Complete UCAT signup first.", 403);
  return { supabase, admin: supabaseAdmin, user, student };
}
export type AppleBillingContext = Awaited<
  ReturnType<typeof appleBillingContext>
>;

export async function appleBillingState(
  context: AppleBillingContext,
): Promise<UcatAppleBillingState> {
  const subjectId = await getUcatSubjectId(context.admin);
  if (!subjectId) throw new AppleBillingError("UCAT billing unavailable.", 503);
  const [apple, stripe, tier, checkout] = await Promise.all([
    context.supabase.from("vstudent_ucat_apple_subscriptions").select("*"),
    context.admin
      .from("student_subscriptions")
      .select("id")
      .eq("student_id", context.student.id)
      .eq("subject_id", subjectId)
      .in("status", [
        "trialing",
        "active",
        "past_due",
        "unpaid",
        "incomplete",
        "paused",
      ])
      .limit(1),
    context.supabase.rpc("get_student_ucat_online_tier", {
      p_student_id: context.student.id,
    }),
    context.admin
      .from("ucat_checkout_holds")
      .select("selection_key")
      .eq("student_id", context.student.id)
      .maybeSingle(),
  ]);
  if (apple.error || stripe.error || tier.error || checkout.error)
    throw new AppleBillingError("Unable to load billing.", 503);
  const rows = [...(apple.data ?? [])].sort((a, b) =>
    (b.access_until ?? "").localeCompare(a.access_until ?? ""),
  );
  const current = rows.find(
    (row) =>
      row.access_until &&
      Date.parse(row.access_until) > Date.now() &&
      [1, 4].includes(row.status ?? 0),
  );
  const managed = current ?? rows.find((row) => row.status === 3);
  const row = managed ?? rows[0];
  return {
    configured: appleBillingConfigured(),
    pendingAppleCheckout:
      checkout.data?.selection_key.startsWith("apple:") ?? false,
    canPurchase:
      appleBillingConfigured() &&
      context.student.ucat_online_tier_override === "default" &&
      tier.data === "free" &&
      !managed &&
      !stripe.data?.length,
    provider: managed ? "apple" : stripe.data?.length ? "stripe" : "none",
    products: UCAT_APPLE_PRODUCTS,
    apple:
      row && row.status !== null && row.environment
        ? {
            status: row.status,
            accessUntil: row.access_until,
            environment: row.environment,
          }
        : null,
  };
}

export async function syncApplePurchase(
  context: AppleBillingContext,
  transactionId: string,
  environment: AppleEnvironment,
) {
  if (!appleBillingConfigured())
    throw new AppleBillingError("Apple billing is not available yet.", 503);
  if (environment === "Sandbox" && !sandboxAccountAllowed(context.user.id))
    throw new AppleBillingError(
      "Sandbox purchases cannot grant this account access.",
      403,
    );
  const { data: token, error } = await context.admin.rpc(
    "ensure_ucat_apple_account",
    { p_student_id: context.student.id },
  );
  if (error || !token)
    throw new AppleBillingError("Unable to resolve purchase account.", 503);
  await reconcileAppleSubscription(
    context.admin,
    token,
    transactionId,
    environment,
    environment === "Sandbox",
  );
  return appleBillingState(context);
}

export async function reconcileAppleSubscription(
  admin: AppleBillingContext["admin"],
  token: string,
  transactionId: string,
  environment: AppleEnvironment,
  allowSandbox: boolean,
) {
  const observedAt = new Date().toISOString();
  const snapshot = await readAppleSubscription({
    transactionId,
    expectedAccountToken: token,
    environment,
    client: createAppleClient(environment),
    verifier: createAppleVerifier(environment),
    now: Date.now(),
  });
  const result = await admin.rpc("record_ucat_apple_subscription", {
    p_snapshot: { ...snapshot },
    p_observed_at: observedAt,
    p_allow_sandbox: environment === "Sandbox" && allowSandbox,
  });
  if (result.error)
    throw new AppleBillingError(
      "Unable to save purchase. Please restore purchases to retry.",
      503,
    );
}
