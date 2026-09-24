import { describe, it } from "jsr:@std/testing/bdd";
import { expect } from "jsr:@std/expect";
import {
  buildStudentPaymentMethodInsert,
  decidePersistFromSetupIntent,
  isPaymentMethodUniqueViolation,
} from "../student-payment-method.ts";

const studentId = "11111111-1111-4111-8111-111111111111";
const customerId = "cus_student";

function succeededSetupIntent(
  overrides: Record<string, unknown> = {},
) {
  return {
    id: "seti_123",
    status: "succeeded",
    customer: customerId,
    payment_method: "pm_visa",
    metadata: { student_id: studentId },
    ...overrides,
  };
}

describe("decidePersistFromSetupIntent", () => {
  it("persists a succeeded setup intent that belongs to the student", () => {
    expect(
      decidePersistFromSetupIntent({
        studentId,
        stripeCustomerId: customerId,
        setupIntent: succeededSetupIntent(),
      }),
    ).toEqual({
      action: "persist",
      paymentMethodId: "pm_visa",
    });
  });

  it("rejects a setup intent that has not succeeded yet", () => {
    expect(
      decidePersistFromSetupIntent({
        studentId,
        stripeCustomerId: customerId,
        setupIntent: succeededSetupIntent({ status: "processing" }),
      }),
    ).toEqual({
      action: "reject",
      code: "setup_intent_not_succeeded",
      retryable: true,
    });
  });

  it("rejects a setup intent for a different Stripe customer", () => {
    expect(
      decidePersistFromSetupIntent({
        studentId,
        stripeCustomerId: customerId,
        setupIntent: succeededSetupIntent({ customer: "cus_other" }),
      }),
    ).toEqual({
      action: "reject",
      code: "customer_mismatch",
      retryable: false,
    });
  });

  it("rejects a setup intent whose metadata belongs to another student", () => {
    expect(
      decidePersistFromSetupIntent({
        studentId,
        stripeCustomerId: customerId,
        setupIntent: succeededSetupIntent({
          metadata: { student_id: "22222222-2222-4222-8222-222222222222" },
        }),
      }),
    ).toEqual({
      action: "reject",
      code: "student_mismatch",
      retryable: false,
    });
  });

  it("rejects a succeeded setup intent with no payment method yet", () => {
    expect(
      decidePersistFromSetupIntent({
        studentId,
        stripeCustomerId: customerId,
        setupIntent: succeededSetupIntent({ payment_method: null }),
      }),
    ).toEqual({
      action: "reject",
      code: "missing_payment_method",
      retryable: true,
    });
  });
});

describe("buildStudentPaymentMethodInsert", () => {
  it("maps Stripe card details and marks the first method as default", () => {
    expect(
      buildStudentPaymentMethodInsert({
        studentId,
        paymentMethodId: "pm_visa",
        isDefault: true,
        card: {
          brand: "visa",
          last4: "4242",
          exp_month: 12,
          exp_year: 2031,
          country: "AU",
          fingerprint: "fp_abc",
        },
      }),
    ).toEqual({
      student_id: studentId,
      stripe_payment_method_id: "pm_visa",
      is_default: true,
      card_brand: "visa",
      card_last4: "4242",
      card_exp_month: 12,
      card_exp_year: 2031,
      card_country: "AU",
      card_fingerprint: "fp_abc",
    });
  });
});

describe("isPaymentMethodUniqueViolation", () => {
  it("treats a duplicate stripe payment method as already persisted", () => {
    expect(isPaymentMethodUniqueViolation({ code: "23505" })).toBe(true);
    expect(isPaymentMethodUniqueViolation({ code: "23503" })).toBe(false);
    expect(isPaymentMethodUniqueViolation(null)).toBe(false);
  });
});
