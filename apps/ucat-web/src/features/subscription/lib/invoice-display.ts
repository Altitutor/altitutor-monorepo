export function formatAmount(cents: number | null): string {
  if (cents === null) return "-";
  return `$${(cents / 100).toFixed(2)}`;
}

export function formatInvoiceDate(dateString: string | null): string {
  if (!dateString) return "-";
  try {
    const date = new Date(`${dateString}T12:00:00Z`);
    return date.toLocaleDateString("en-AU", {
      timeZone: "Australia/Adelaide",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
}

function getAdelaideTodayIsoDate(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Adelaide",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return "";
  return `${year}-${month}-${day}`;
}

export function isInvoiceOverdue(invoice: {
  status: string | null;
  paid_at: string | null;
  invoice_date: string | null;
}): boolean {
  if (invoice.status !== "open") return false;
  if (invoice.paid_at) return false;
  if (!invoice.invoice_date) return false;
  const todayAdelaide = getAdelaideTodayIsoDate();
  if (!todayAdelaide) return false;
  return invoice.invoice_date < todayAdelaide;
}

export function getInvoiceTotalAmount(invoice: {
  total_charges_cents: number | null;
  total_subsidies_cents: number | null;
  amount_due_cents: number | null;
}): number | null {
  if (invoice.total_charges_cents != null) {
    const subsidies = invoice.total_subsidies_cents ?? 0;
    return invoice.total_charges_cents - subsidies;
  }
  return invoice.amount_due_cents;
}

export function inferBillingFrequency(subscription: {
  current_period_start: string | null;
  current_period_end: string | null;
}): string {
  if (!subscription.current_period_start || !subscription.current_period_end) {
    return "-";
  }
  const start = new Date(subscription.current_period_start).getTime();
  const end = new Date(subscription.current_period_end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return "-";
  }
  const days = (end - start) / (1000 * 60 * 60 * 24);
  if (days <= 10) return "Weekly";
  if (days <= 45) return "Monthly";
  if (days <= 120) return "Quarterly";
  if (days <= 220) return "Biannual";
  return "Yearly";
}

export function formatSubscriptionStatus(status: string): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
