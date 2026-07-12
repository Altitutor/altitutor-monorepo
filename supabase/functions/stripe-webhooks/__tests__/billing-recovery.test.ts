import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import type Stripe from "npm:stripe@16.6.0";
import {
  getInvoiceSubscriptionId,
  stripeTimestampToIso,
} from "../shared/billing-recovery.ts";

describe("Stripe billing recovery helpers", () => {
  it("extracts string and expanded subscription IDs", () => {
    expect(
      getInvoiceSubscriptionId({
        subscription: "sub_123",
      } as Stripe.Invoice),
    ).toBe("sub_123");
    expect(
      getInvoiceSubscriptionId({
        subscription: { id: "sub_456" },
      } as Stripe.Invoice),
    ).toBe("sub_456");
  });

  it("does not invent a subscription ID", () => {
    expect(
      getInvoiceSubscriptionId({ subscription: null } as Stripe.Invoice),
    ).toBeNull();
  });

  it("converts Stripe seconds to an ISO timestamp", () => {
    expect(stripeTimestampToIso(1_700_000_000)).toBe(
      "2023-11-14T22:13:20.000Z",
    );
    expect(stripeTimestampToIso(null)).toBeNull();
  });
});
