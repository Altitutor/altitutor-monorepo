import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@altitutor/shared";
import {
  MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES,
  type UcatSubscriptionRow,
} from "@/lib/ucat/ucat-subscription";
import type {
  UcatSubscriptionInvoice,
  UcatSubscriptionInvoiceItem,
} from "@/features/subscription/types/ucat-subscription-billing";
import { isManageableUcatSubscriptionStatus } from "@/lib/ucat/subscription-status";
import { collectPages } from "@/lib/supabase/collect-pages";

type InvoiceRow = Database["public"]["Views"]["vstudent_invoices"]["Row"];
type InvoiceItemRow =
  Database["public"]["Views"]["vstudent_invoice_items"]["Row"];
type SubscriptionRow =
  Database["public"]["Views"]["vstudent_subscriptions"]["Row"];
type SelectedSubscriptionRow = Pick<
  SubscriptionRow,
  | "id"
  | "status"
  | "current_period_start"
  | "current_period_end"
  | "cancel_at_period_end"
  | "cancel_at"
  | "stripe_subscription_id"
  | "stripe_price_id"
  | "plan_tier"
  | "billing_interval"
  | "billing_recovery_invoice_id"
  | "billing_recovery_started_at"
  | "billing_recovery_next_attempt_at"
  | "billing_recovery_requires_action"
  | "created_at"
  | "updated_at"
>;

const SUBSCRIPTION_SELECT =
  "id, status, current_period_start, current_period_end, cancel_at_period_end, cancel_at, stripe_subscription_id, stripe_price_id, plan_tier, billing_interval, billing_recovery_invoice_id, billing_recovery_started_at, billing_recovery_next_attempt_at, billing_recovery_requires_action, created_at, updated_at";

/**
 * Optional UCAT subject filter for student-scoped subscription queries.
 * Uses the authenticated helper RPC when available; otherwise returns null and
 * callers should rely on vstudent_subscriptions (already current-student scoped).
 */
async function resolveUcatSubjectId(
  userSupabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await userSupabase.rpc("get_ucat_subject_id");
  if (!error && typeof data === "string" && data.length > 0) {
    return data;
  }

  const { data: subject, error: subjectError } = await userSupabase
    .from("vstudent_subscription_subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();

  if (subjectError) throw subjectError;
  return subject?.id ?? null;
}

async function fetchUcatSubscription(
  supabase: SupabaseClient<Database>,
): Promise<UcatSubscriptionRow | null> {
  const ucatSubjectId = await resolveUcatSubjectId(supabase);

  let query = supabase
    .from("vstudent_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .in("status", [...MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1);

  if (ucatSubjectId) {
    query = query.eq("subject_id", ucatSubjectId);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw error;
  if (!data?.id || !data.status || !data.stripe_subscription_id) return null;

  return {
    id: data.id,
    status: data.status,
    current_period_start: data.current_period_start,
    current_period_end: data.current_period_end,
    cancel_at_period_end: data.cancel_at_period_end ?? false,
    cancel_at: data.cancel_at,
    stripe_subscription_id: data.stripe_subscription_id,
    stripe_price_id: data.stripe_price_id,
    plan_tier: data.plan_tier ?? null,
    billing_interval: data.billing_interval ?? null,
    billing_recovery_invoice_id: data.billing_recovery_invoice_id ?? null,
    billing_recovery_started_at: data.billing_recovery_started_at ?? null,
    billing_recovery_next_attempt_at:
      data.billing_recovery_next_attempt_at ?? null,
    billing_recovery_requires_action:
      data.billing_recovery_requires_action ?? false,
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
}

function toSubscriptionRow(
  subscription: SelectedSubscriptionRow,
): UcatSubscriptionRow | null {
  if (
    !subscription.id ||
    !subscription.status ||
    !subscription.stripe_subscription_id
  ) {
    return null;
  }

  return {
    id: subscription.id,
    status: subscription.status,
    current_period_start: subscription.current_period_start,
    current_period_end: subscription.current_period_end,
    cancel_at_period_end: subscription.cancel_at_period_end ?? false,
    cancel_at: subscription.cancel_at,
    stripe_subscription_id: subscription.stripe_subscription_id,
    stripe_price_id: subscription.stripe_price_id,
    plan_tier: subscription.plan_tier ?? null,
    billing_interval: subscription.billing_interval ?? null,
    billing_recovery_invoice_id:
      subscription.billing_recovery_invoice_id ?? null,
    billing_recovery_started_at:
      subscription.billing_recovery_started_at ?? null,
    billing_recovery_next_attempt_at:
      subscription.billing_recovery_next_attempt_at ?? null,
    billing_recovery_requires_action:
      subscription.billing_recovery_requires_action ?? false,
    created_at: subscription.created_at ?? new Date().toISOString(),
    updated_at: subscription.updated_at ?? new Date().toISOString(),
  };
}

async function fetchUcatSubscriptions(
  supabase: SupabaseClient<Database>,
): Promise<UcatSubscriptionRow[]> {
  const ucatSubjectId = await resolveUcatSubjectId(supabase);

  // vstudent_subscriptions is already scoped to the current student. If the
  // UCAT subject helper/RPC is temporarily unavailable, still return the
  // student-scoped rows rather than an empty list.
  let query = supabase
    .from("vstudent_subscriptions")
    .select(SUBSCRIPTION_SELECT)
    .order("updated_at", { ascending: false });

  if (ucatSubjectId) {
    query = query.eq("subject_id", ucatSubjectId);
  }

  const { data, error } = await query;

  if (error) throw error;

  return (data ?? [])
    .map((subscription) => toSubscriptionRow(subscription))
    .filter((subscription): subscription is UcatSubscriptionRow => {
      return subscription != null;
    });
}

export function pickCurrentSubscription(
  subscriptions: UcatSubscriptionRow[],
): UcatSubscriptionRow | null {
  const manageable = subscriptions.filter((subscription) =>
    isManageableUcatSubscriptionStatus(subscription.status),
  );

  return manageable[0] ?? null;
}

async function fetchInvoiceItemsByInvoiceId(
  supabase: SupabaseClient<Database>,
  invoiceIds: string[],
): Promise<Map<string, UcatSubscriptionInvoiceItem[]>> {
  const items = await collectPages<
    Pick<
      InvoiceItemRow,
      "invoice_id" | "description" | "subject_name" | "amount_cents"
    >
  >((from, to) =>
    supabase
      .from("vstudent_invoice_items")
      .select("invoice_id, description, subject_name, amount_cents")
      .in("invoice_id", invoiceIds)
      .order("created_at", { ascending: false })
      .range(from, to),
  );
  const byInvoiceId = new Map<string, UcatSubscriptionInvoiceItem[]>();
  for (const item of items) {
    if (!item.invoice_id) continue;
    const invoiceItems = byInvoiceId.get(item.invoice_id) ?? [];
    invoiceItems.push({
      description: item.description,
      subject_name: item.subject_name,
      amount_cents: item.amount_cents,
    });
    byInvoiceId.set(item.invoice_id, invoiceItems);
  }
  return byInvoiceId;
}

function toSubscriptionInvoice(
  invoice: InvoiceRow,
  items: UcatSubscriptionInvoiceItem[],
): UcatSubscriptionInvoice | null {
  if (!invoice.id) return null;

  return {
    id: invoice.id,
    stripe_invoice_id: invoice.stripe_invoice_id,
    invoice_date: invoice.invoice_date,
    status: invoice.status,
    paid_at: invoice.paid_at,
    hosted_invoice_url: invoice.hosted_invoice_url,
    total_charges_cents: invoice.total_charges_cents,
    total_subsidies_cents: invoice.total_subsidies_cents,
    amount_due_cents: invoice.amount_due_cents,
    items,
  };
}

export async function fetchUcatSubscriptionInvoices(
  supabase: SupabaseClient<Database>,
  subscriptionIds: string[],
): Promise<UcatSubscriptionInvoice[]> {
  if (subscriptionIds.length === 0) return [];

  const { data: invoices, error } = await supabase
    .from("vstudent_invoices")
    .select("*")
    .eq("billing_source", "subscription")
    .in("student_subscription_id", subscriptionIds)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (invoices ?? []).filter(
    (invoice): invoice is InvoiceRow & { id: string } => Boolean(invoice.id),
  );
  if (rows.length === 0) return [];

  const itemsByInvoiceId = await fetchInvoiceItemsByInvoiceId(
    supabase,
    rows.map((invoice) => invoice.id),
  );
  const withItems = rows.map((invoice) =>
    toSubscriptionInvoice(invoice, itemsByInvoiceId.get(invoice.id) ?? []),
  );

  return withItems.filter(
    (invoice): invoice is UcatSubscriptionInvoice => invoice != null,
  );
}

export async function fetchSubscriptionBillingForUser(
  supabase: SupabaseClient<Database>,
) {
  const subscriptions = await fetchUcatSubscriptions(supabase);
  const subscription =
    pickCurrentSubscription(subscriptions) ??
    (await fetchUcatSubscription(supabase));
  const subscriptionIds = subscriptions.map((row) => row.id);
  const invoices = await fetchUcatSubscriptionInvoices(
    supabase,
    subscriptionIds,
  );

  return { subscription, subscriptions, invoices };
}
