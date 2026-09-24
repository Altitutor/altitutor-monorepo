export type PaymentMethod = {
  id: string;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default?: boolean;
};

type BillingWithPaymentMethod = {
  default_payment_method?: unknown;
};

export function readPaymentMethod(
  billing: BillingWithPaymentMethod | null | undefined,
): PaymentMethod | null {
  const value = billing?.default_payment_method;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.card_last4 !== "string" ||
    typeof row.card_brand !== "string"
  ) {
    return null;
  }
  return {
    id: String(row.id ?? ""),
    card_brand: row.card_brand,
    card_last4: row.card_last4,
    card_exp_month: Number(row.card_exp_month ?? 0),
    card_exp_year: Number(row.card_exp_year ?? 0),
    is_default: Boolean(row.is_default),
  };
}
