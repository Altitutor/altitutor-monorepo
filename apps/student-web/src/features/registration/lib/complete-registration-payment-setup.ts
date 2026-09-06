export type RegistrationPaymentVerifyResult = {
  verified?: boolean;
  code?: string;
  error?: string;
};

export type RegistrationPaymentSetupIntent = {
  id?: string | null;
  status?: string | null;
};

export async function completeRegistrationPaymentSetup(input: {
  setupIntent: RegistrationPaymentSetupIntent | null | undefined;
  verify: (
    setupIntentId: string,
  ) => Promise<RegistrationPaymentVerifyResult>;
}): Promise<
  | { ok: true }
  | { ok: false; resultCode: string; message: string }
> {
  const setupIntent = input.setupIntent;
  if (!setupIntent || setupIntent.status !== "succeeded") {
    return {
      ok: false,
      resultCode: "setup_intent_not_succeeded",
      message: "Failed to add payment method",
    };
  }

  if (!setupIntent.id) {
    return {
      ok: false,
      resultCode: "missing_setup_intent_id",
      message: "Failed to add payment method",
    };
  }

  const first = await input.verify(setupIntent.id);
  if (first.verified) {
    return { ok: true };
  }

  const retry = await input.verify(setupIntent.id);
  if (retry.verified) {
    return { ok: true };
  }

  return {
    ok: false,
    resultCode:
      retry.code || first.code || "verification_failed_after_retry",
    message:
      "Payment method added but verification failed. Please try again.",
  };
}
