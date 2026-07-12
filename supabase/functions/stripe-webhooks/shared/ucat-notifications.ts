import type { SupabaseClient } from "jsr:@supabase/supabase-js@2";

type UcatInvoiceRecipient = {
  studentId: string;
  isUcat: boolean;
};

const paymentRecoveryDedupeKey = (stripeInvoiceId: string) =>
  `ucat:billing:payment-failed:${stripeInvoiceId}`;

async function resolveUcatInvoiceRecipient(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
): Promise<UcatInvoiceRecipient | null> {
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .select("student_id, student_subscription_id")
    .eq("stripe_invoice_id", stripeInvoiceId)
    .is("deleted_at", null)
    .maybeSingle();

  if (
    invoiceError ||
    !invoice?.student_id ||
    !invoice.student_subscription_id
  ) {
    if (invoiceError) {
      console.warn(
        "[webhook] Failed to resolve notification invoice",
        invoiceError,
      );
    }
    return null;
  }

  const { data: subscription, error: subscriptionError } = await supabase
    .from("student_subscriptions")
    .select("subject_id")
    .eq("id", invoice.student_subscription_id)
    .maybeSingle();

  if (subscriptionError || !subscription?.subject_id) return null;

  const { data: subject, error: subjectError } = await supabase
    .from("subjects")
    .select("name")
    .eq("id", subscription.subject_id)
    .maybeSingle();

  if (subjectError) return null;
  return {
    studentId: invoice.student_id,
    isUcat: subject?.name?.trim().toUpperCase() === "UCAT",
  };
}

export async function notifyUcatInvoicePaymentFailed(
  supabase: SupabaseClient,
  input: {
    stripeInvoiceId: string;
    failureCode: string;
    nextPaymentAttemptAt?: string | null;
    requiresAction?: boolean;
  },
): Promise<void> {
  const recipient = await resolveUcatInvoiceRecipient(
    supabase,
    input.stripeInvoiceId,
  );
  if (!recipient?.isUcat) return;

  const requiresAction = input.requiresAction ?? false;
  const { error } = await supabase.from("notifications").upsert(
    {
      student_id: recipient.studentId,
      notification_type: requiresAction
        ? "ucat.billing.payment_action_required"
        : "ucat.billing.payment_failed",
      app_scope: "ucat_web",
      title: requiresAction
        ? "Please confirm your payment"
        : "Your payment didn’t go through",
      body: requiresAction
        ? "Confirm the payment in Stripe to keep your paid UCAT access. Your access continues temporarily while this is resolved."
        : "Your paid UCAT access continues temporarily while Stripe retries. Update your payment method to avoid moving to Free.",
      action_url: "/settings/plan/subscription",
      metadata: {
        stripe_invoice_id: input.stripeInvoiceId,
        failure_code: input.failureCode,
        next_payment_attempt_at: input.nextPaymentAttemptAt ?? null,
        requires_action: requiresAction,
      },
      dedupe_key: paymentRecoveryDedupeKey(input.stripeInvoiceId),
      priority: "critical",
      resolved_at: null,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: false },
  );

  if (error) {
    console.warn("[webhook] Failed to create UCAT payment notification", error);
  }
}

export async function notifyUcatInvoiceFinalizationFailed(
  supabase: SupabaseClient,
  input: { stripeInvoiceId: string; failureCode: string },
): Promise<void> {
  const recipient = await resolveUcatInvoiceRecipient(
    supabase,
    input.stripeInvoiceId,
  );
  if (!recipient?.isUcat) return;

  const { error } = await supabase.from("notifications").upsert(
    {
      student_id: recipient.studentId,
      notification_type: "ucat.billing.invoice_finalization_failed",
      app_scope: "ucat_web",
      title: "We need billing information from you",
      body: "Stripe couldn’t prepare your latest bill. Review your billing details or contact support; your current access has not been removed.",
      action_url: "/settings/plan/subscription",
      metadata: {
        stripe_invoice_id: input.stripeInvoiceId,
        failure_code: input.failureCode,
      },
      dedupe_key: `ucat:billing:finalization-failed:${input.stripeInvoiceId}`,
      priority: "critical",
      resolved_at: null,
    },
    { onConflict: "dedupe_key", ignoreDuplicates: false },
  );

  if (error) {
    console.warn(
      "[webhook] Failed to create UCAT finalization notification",
      error,
    );
  }
}

export async function resolveUcatInvoiceFinalizationFailedNotification(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ resolved_at: now, updated_at: now })
    .eq("dedupe_key", `ucat:billing:finalization-failed:${stripeInvoiceId}`)
    .is("resolved_at", null);

  if (error) {
    console.warn(
      "[webhook] Failed to resolve UCAT finalization notification",
      error,
    );
  }
}

export async function resolveUcatInvoicePaymentFailedNotification(
  supabase: SupabaseClient,
  stripeInvoiceId: string,
): Promise<void> {
  const recipient = await resolveUcatInvoiceRecipient(
    supabase,
    stripeInvoiceId,
  );
  const now = new Date().toISOString();
  const { data: resolved, error } = await supabase
    .from("notifications")
    .update({ resolved_at: now, updated_at: now })
    .eq("dedupe_key", paymentRecoveryDedupeKey(stripeInvoiceId))
    .is("resolved_at", null)
    .select("id");

  if (error) {
    console.warn(
      "[webhook] Failed to resolve UCAT payment notification",
      error,
    );
    return;
  }

  if (!recipient?.isUcat || !resolved?.length) return;

  const { error: recoveryError } = await supabase.from("notifications").upsert(
    {
      student_id: recipient.studentId,
      notification_type: "ucat.billing.payment_recovered",
      app_scope: "ucat_web",
      title: "Your payment is fixed",
      body: "Your paid UCAT plan is active and your access will continue.",
      action_url: "/settings/plan/subscription",
      metadata: { stripe_invoice_id: stripeInvoiceId },
      dedupe_key: `ucat:billing:payment-recovered:${stripeInvoiceId}`,
      priority: "normal",
    },
    { onConflict: "dedupe_key", ignoreDuplicates: true },
  );

  if (recoveryError) {
    console.warn(
      "[webhook] Failed to create UCAT payment recovery notification",
      recoveryError,
    );
  }
}

export async function resolveUcatBillingRecoveryNotificationsForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ resolved_at: now, updated_at: now })
    .eq("student_id", studentId)
    .eq("app_scope", "ucat_web")
    .in("notification_type", [
      "ucat.billing.payment_failed",
      "ucat.billing.payment_action_required",
      "ucat.billing.invoice_finalization_failed",
    ])
    .is("resolved_at", null);

  if (error) {
    console.warn(
      "[webhook] Failed to resolve terminal UCAT billing notifications",
      error,
    );
  }
}

export async function resolveUcatBillingAccessEndedNotificationsForStudent(
  supabase: SupabaseClient,
  studentId: string,
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({ resolved_at: now, updated_at: now })
    .eq("student_id", studentId)
    .eq("app_scope", "ucat_web")
    .eq("notification_type", "ucat.billing.access_ended")
    .is("resolved_at", null);

  if (error) {
    console.warn(
      "[webhook] Failed to resolve prior UCAT access-ended notifications",
      error,
    );
  }
}

export async function notifyUcatBillingAccessEnded(
  supabase: SupabaseClient,
  input: { studentId: string; stripeSubscriptionId: string },
): Promise<{
  notificationId: string;
  emailSentAt: string | null;
  metadata: Record<string, unknown>;
} | null> {
  const dedupeKey = `ucat:billing:access-ended:${input.stripeSubscriptionId}`;
  const { data, error } = await supabase
    .from("notifications")
    .upsert(
      {
        student_id: input.studentId,
        notification_type: "ucat.billing.access_ended",
        app_scope: "ucat_web",
        title: "Your paid UCAT plan has ended",
        body: "We couldn’t recover your payment, so you’ve moved to Free. Your account, practice history and results are safe.",
        action_url: "/settings/plan/subscription",
        metadata: { stripe_subscription_id: input.stripeSubscriptionId },
        dedupe_key: dedupeKey,
        priority: "critical",
      },
      { onConflict: "dedupe_key", ignoreDuplicates: true },
    )
    .select("id, metadata");

  if (error) {
    throw new Error(
      `Failed to create UCAT access-ended notification: ${error.message}`,
    );
  }

  const row =
    data?.[0] ??
    (
      await supabase
        .from("notifications")
        .select("id, metadata")
        .eq("dedupe_key", dedupeKey)
        .maybeSingle()
    ).data;
  if (!row?.id) {
    throw new Error("Failed to resolve UCAT access-ended notification");
  }

  const metadata =
    row.metadata &&
    typeof row.metadata === "object" &&
    !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    notificationId: row.id,
    emailSentAt:
      typeof metadata.email_sent_at === "string"
        ? metadata.email_sent_at
        : null,
    metadata,
  };
}

export async function markUcatBillingAccessEndedEmailSent(
  supabase: SupabaseClient,
  input: { notificationId: string; metadata: Record<string, unknown> },
): Promise<void> {
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("notifications")
    .update({
      metadata: { ...input.metadata, email_sent_at: now },
      updated_at: now,
    })
    .eq("id", input.notificationId);

  if (error) {
    throw new Error(
      `Failed to record terminal billing email: ${error.message}`,
    );
  }
}
