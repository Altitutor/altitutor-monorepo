import { getFutureInvoicePayment } from "../invoiceDisplay";

describe("getFutureInvoicePayment", () => {
  it("applies remaining credit after charges from earlier future sessions", () => {
    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 8_000,
        invoiceCurrency: "aud",
        creditBalanceCents: -12_000,
        creditCurrency: "aud",
      }),
    ).toEqual({ creditAppliedCents: 4_000, payableCents: 6_000 });
  });

  it("does not apply a positive customer balance or another currency", () => {
    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: "aud",
        creditBalanceCents: 2_000,
        creditCurrency: "aud",
      }),
    ).toEqual({ creditAppliedCents: 0, payableCents: 10_000 });

    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: "aud",
        creditBalanceCents: -10_000,
        creditCurrency: "usd",
      }),
    ).toEqual({ creditAppliedCents: 0, payableCents: 10_000 });
  });
});
