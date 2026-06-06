export type UcatSubscriptionDetails = {
  id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancel_at: string | null;
  stripe_subscription_id: string;
  stripe_price_id: string | null;
  created_at: string;
  updated_at: string;
};

export type UcatSubscriptionInvoiceItem = {
  description: string | null;
  subject_name: string | null;
  amount_cents: number | null;
};

export type UcatSubscriptionInvoice = {
  id: string;
  invoice_date: string | null;
  status: string | null;
  paid_at: string | null;
  hosted_invoice_url: string | null;
  total_charges_cents: number | null;
  total_subsidies_cents: number | null;
  amount_due_cents: number | null;
  items: UcatSubscriptionInvoiceItem[];
};

export type UcatSubscriptionBillingResponse = {
  subscription: UcatSubscriptionDetails | null;
  invoices: UcatSubscriptionInvoice[];
};
