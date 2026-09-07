export type SetupIntentSnapshot = {
  id: string;
  status: string;
  customer: string | null;
  payment_method: string | null;
  metadata?: { student_id?: string } | null;
};

export type CardSnapshot = {
  brand?: string | null;
  last4?: string | null;
  exp_month?: number | null;
  exp_year?: number | null;
  country?: string | null;
  fingerprint?: string | null;
};

export type PersistSetupIntentDecision =
  | { action: "persist"; paymentMethodId: string }
  | { action: "reject"; code: string; retryable: boolean };

export type StudentPaymentMethodInsert = {
  student_id: string;
  stripe_payment_method_id: string;
  is_default: boolean;
  card_brand: string;
  card_last4: string;
  card_exp_month: number;
  card_exp_year: number;
  card_country: string | null;
  card_fingerprint: string | null;
};

export function decidePersistFromSetupIntent(input: {
  studentId: string;
  stripeCustomerId: string;
  setupIntent: SetupIntentSnapshot;
}): PersistSetupIntentDecision {
  const { studentId, stripeCustomerId, setupIntent } = input;
  const metadataStudentId = setupIntent.metadata?.student_id;

  if (metadataStudentId && metadataStudentId !== studentId) {
    return { action: "reject", code: "student_mismatch", retryable: false };
  }

  if (!setupIntent.customer || setupIntent.customer !== stripeCustomerId) {
    return { action: "reject", code: "customer_mismatch", retryable: false };
  }

  if (setupIntent.status !== "succeeded") {
    return {
      action: "reject",
      code: "setup_intent_not_succeeded",
      retryable: true,
    };
  }

  if (!setupIntent.payment_method) {
    return {
      action: "reject",
      code: "missing_payment_method",
      retryable: true,
    };
  }

  return { action: "persist", paymentMethodId: setupIntent.payment_method };
}

export function buildStudentPaymentMethodInsert(input: {
  studentId: string;
  paymentMethodId: string;
  isDefault: boolean;
  card?: CardSnapshot | null;
}): StudentPaymentMethodInsert {
  const card = input.card ?? {};
  return {
    student_id: input.studentId,
    stripe_payment_method_id: input.paymentMethodId,
    is_default: input.isDefault,
    card_brand: card.brand || "unknown",
    card_last4: card.last4 || "0000",
    card_exp_month: card.exp_month || 1,
    card_exp_year: card.exp_year || new Date().getFullYear() + 5,
    card_country: card.country || null,
    card_fingerprint: card.fingerprint || null,
  };
}

export function isPaymentMethodUniqueViolation(
  error: { code?: string } | null | undefined,
): boolean {
  return error?.code === "23505";
}

export function stripeId(
  value: string | { id?: string } | null | undefined,
): string | null {
  if (!value) return null;
  if (typeof value === "string") return value;
  return value.id ?? null;
}
