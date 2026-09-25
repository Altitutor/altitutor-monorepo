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
        isFirstInCurrency: false,
      }),
    ).toEqual({ creditAppliedCents: 4_000, balanceAddedCents: 0, payableCents: 6_000 });
  });

  it("adds a positive customer balance only to the next invoice in that currency", () => {
    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: "aud",
        creditBalanceCents: 2_000,
        creditCurrency: "aud",
        isFirstInCurrency: true,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 2_000, payableCents: 12_000 });

    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: "aud",
        creditBalanceCents: 2_000,
        creditCurrency: "aud",
        isFirstInCurrency: false,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 0, payableCents: 10_000 });

    expect(
      getFutureInvoicePayment({
        fullAmountCents: 10_000,
        priorChargeCents: 0,
        invoiceCurrency: "aud",
        creditBalanceCents: -10_000,
        creditCurrency: "usd",
        isFirstInCurrency: true,
      }),
    ).toEqual({ creditAppliedCents: 0, balanceAddedCents: 0, payableCents: 10_000 });
  });
});
