import { getInvoiceTotalAmount } from "../invoice-display";

describe("subscription invoice totals", () => {
  const invoice = {
    total_charges_cents: 4000,
    total_subsidies_cents: 0,
    amount_due_cents: 3200,
  };
  it("uses Stripe's final total including the founder discount", () => {
    expect(getInvoiceTotalAmount({ ...invoice, total_cents: 3200 })).toBe(3200);
  });
  it("preserves a zero total for a fully discounted invoice", () => {
    expect(getInvoiceTotalAmount({ ...invoice, total_cents: 0 })).toBe(0);
  });
  it("retains legacy line totals when Stripe total is unavailable", () => {
    expect(getInvoiceTotalAmount(invoice)).toBe(4000);
  });
});
