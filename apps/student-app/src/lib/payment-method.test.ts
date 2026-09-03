import assert from "node:assert/strict";
import test from "node:test";

import { readPaymentMethod } from "./payment-method";

test("readPaymentMethod normalizes the billing JSON payload", () => {
  assert.deepEqual(
    readPaymentMethod({
      default_payment_method: {
        id: "pm_123",
        card_brand: "visa",
        card_last4: "4242",
        card_exp_month: 12,
        card_exp_year: 2030,
        is_default: true,
      },
    }),
    {
      id: "pm_123",
      card_brand: "visa",
      card_last4: "4242",
      card_exp_month: 12,
      card_exp_year: 2030,
      is_default: true,
    },
  );
});

test("readPaymentMethod rejects absent and malformed card payloads", () => {
  assert.equal(readPaymentMethod(null), null);
  assert.equal(readPaymentMethod({ default_payment_method: [] }), null);
  assert.equal(
    readPaymentMethod({ default_payment_method: { card_brand: "visa" } }),
    null,
  );
});
