import { completeRegistrationPaymentSetup } from "../complete-registration-payment-setup";

describe("completeRegistrationPaymentSetup", () => {
  it("does not call verify when Stripe did not succeed the setup intent", async () => {
    const verify = jest.fn();

    await expect(
      completeRegistrationPaymentSetup({
        setupIntent: { id: "seti_123", status: "processing" },
        verify,
      }),
    ).resolves.toEqual({
      ok: false,
      resultCode: "setup_intent_not_succeeded",
      message: "Failed to add payment method",
    });
    expect(verify).not.toHaveBeenCalled();
  });

  it("persists a succeeded setup intent without waiting for the webhook", async () => {
    const verify = jest.fn().mockResolvedValue({ verified: true });

    await expect(
      completeRegistrationPaymentSetup({
        setupIntent: { id: "seti_123", status: "succeeded" },
        verify,
      }),
    ).resolves.toEqual({ ok: true });

    expect(verify).toHaveBeenCalledTimes(1);
    expect(verify).toHaveBeenCalledWith("seti_123");
  });

  it("retries verification once if the first persist has not landed", async () => {
    const verify = jest
      .fn()
      .mockResolvedValueOnce({ verified: false, code: "setup_intent_not_succeeded" })
      .mockResolvedValueOnce({ verified: true });

    await expect(
      completeRegistrationPaymentSetup({
        setupIntent: { id: "seti_123", status: "succeeded" },
        verify,
      }),
    ).resolves.toEqual({ ok: true });

    expect(verify).toHaveBeenCalledTimes(2);
  });

  it("fails after one retry when the card is still not saved", async () => {
    const verify = jest.fn().mockResolvedValue({
      verified: false,
      code: "missing_payment_method",
    });

    await expect(
      completeRegistrationPaymentSetup({
        setupIntent: { id: "seti_123", status: "succeeded" },
        verify,
      }),
    ).resolves.toEqual({
      ok: false,
      resultCode: "missing_payment_method",
      message: "Payment method added but verification failed. Please try again.",
    });
  });
});
