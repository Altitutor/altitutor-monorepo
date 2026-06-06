import type { Database } from "@altitutor/shared";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  MANAGEABLE_UCAT_SUBSCRIPTION_STATUSES,
  type UcatSubscriptionRow,
} from "@/lib/ucat/ucat-subscription";
import type {
  UcatSubscriptionInvoice,
  UcatSubscriptionInvoiceItem,
} from "@/features/subscription/types/ucat-subscription-billing";

type InvoiceRow = Database["public"]["Views"]["vstudent_invoices"]["Row"];
async function getUcatSubjectId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase
    .from("vstudent_subjects")
    .select("id")
    .eq("name", "UCAT")
    .maybeSingle();

  if (error) throw error;
  return data?.id ?? null;
}

export async function fetchUcatSubscription(): Promise<UcatSubscriptionRow | null> {
  const supabase = getSupabaseBrowserClient();
  const ucatSubjectId = await getUcatSubjectId();
  if (!ucatSubjectId) return null;

  const { data, error } = await supabase
    .from("vstudent_subscriptions")
    .select(
      "id, status, current_period_start, current_period_end, cancel_at_period_end, cancel_at, stripe_subscription_id, stripe_price_id, created_at, updated_at",
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
    created_at: data.created_at ?? new Date().toISOString(),
    updated_at: data.updated_at ?? new Date().toISOString(),
  };
}

async function fetchInvoiceItems(
  invoiceId: string,
): Promise<UcatSubscriptionInvoiceItem[]> {
  const supabase = getSupabaseBrowserClient();
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

/**
 * Subscription invoices for the current student's UCAT subscription.
 * Mirrors student-web billing: vstudent_invoices + vstudent_invoice_items,
 * filtered to billing_source = subscription and this subscription id.
 */
export async function fetchUcatSubscriptionInvoices(
  subscriptionId: string,
): Promise<UcatSubscriptionInvoice[]> {
  const supabase = getSupabaseBrowserClient();
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
      const items = await fetchInvoiceItems(invoice.id);
      return toSubscriptionInvoice(invoice, items);
    }),
  );

  return withItems.filter(
    (invoice): invoice is UcatSubscriptionInvoice => invoice != null,
  );
}

async function syncSubscriptionFromStripe(): Promise<void> {
  try {
    await fetch("/api/ucat/subscription/sync", {
      method: "GET",
      credentials: "same-origin",
    });
  } catch {
    // Non-blocking — page still loads from DB
  }
}

export async function fetchUcatSubscriptionBilling() {
  await syncSubscriptionFromStripe();
  const subscription = await fetchUcatSubscription();
  const invoices = subscription
    ? await fetchUcatSubscriptionInvoices(subscription.id)
    : [];

  return { subscription, invoices };
}
