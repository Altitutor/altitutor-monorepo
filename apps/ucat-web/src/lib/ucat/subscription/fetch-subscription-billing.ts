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

type InvoiceRow = Database["public"]["Views"]["vstudent_invoices"]["Row"];

async function getUcatSubjectId(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("vstudent_subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

async function fetchUcatSubscription(
  supabase: SupabaseClient<Database>,
): Promise<UcatSubscriptionRow | null> {
  const ucatSubjectId = await getUcatSubjectId(supabase);
  if (!ucatSubjectId) return null;

  const { data, error } = await supabase
    .from("vstudent_subscriptions")
    .select(
      "id, status, current_period_start, current_period_end, cancel_at_period_end, cancel_at, stripe_subscription_id, stripe_price_id, plan_tier, billing_interval, created_at, updated_at",
    )
    .eq("subject_id", ucatSubjectId)
    .in("status", [...MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES])
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

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
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
}

async function fetchInvoiceItems(
  supabase: SupabaseClient<Database>,
  invoiceId: string,
): Promise<UcatSubscriptionInvoiceItem[]> {
  const { data, error } = await supabase
    .from("vstudent_invoice_items")
    .select("description, subject_name, amount_cents")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map((item) => ({
    description: item.description,
    subject_name: item.subject_name,
    amount_cents: item.amount_cents,
  }));
}

function toSubscriptionInvoice(
  invoice: InvoiceRow,
  items: UcatSubscriptionInvoiceItem[],
): UcatSubscriptionInvoice | null {
  if (!invoice.id) return null;

  return {
    id: invoice.id,
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

async function fetchUcatSubscriptionInvoices(
  supabase: SupabaseClient<Database>,
  subscriptionId: string,
): Promise<UcatSubscriptionInvoice[]> {
  const { data: invoices, error } = await supabase
    .from("vstudent_invoices")
    .select("*")
    .eq("billing_source", "subscription")
    .eq("student_subscription_id", subscriptionId)
    .order("invoice_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (invoices ?? []).filter(
    (invoice): invoice is InvoiceRow & { id: string } => Boolean(invoice.id),
  );

  const withItems = await Promise.all(
    rows.map(async (invoice) => {
      const items = await fetchInvoiceItems(supabase, invoice.id);
      return toSubscriptionInvoice(invoice, items);
    }),
  );

  return withItems.filter(
    (invoice): invoice is UcatSubscriptionInvoice => invoice != null,
  );
}

export async function fetchSubscriptionBillingForUser(
  supabase: SupabaseClient<Database>,
) {
  const subscription = await fetchUcatSubscription(supabase);
  const invoices = subscription
    ? await fetchUcatSubscriptionInvoices(supabase, subscription.id)
    : [];

  return { subscription, invoices };
}
