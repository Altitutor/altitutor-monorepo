import { getCheckoutSubmitPresentation } from "../checkout-submit-presentation";

describe("getCheckoutSubmitPresentation", () => {
  const readyTrial = {
    checkoutSubmitting: false,
    checkoutError: null,
    paymentLoading: false,
    offerTrialDays: 0,
    referralGiftApplied: false,
    hasStandardTrial: true,
    standardTrialDays: 14,
    interval: "month",
  } as const;

  it("explains that secure payment is still loading", () => {
    expect(
      getCheckoutSubmitPresentation({
        ...readyTrial,
        paymentLoading: true,
      }),
    ).toEqual({
      label: "Loading secure payment…",
      status:
        "Secure payment fields are loading. This button will activate when they’re ready.",
    });
  });

  it("restores the purchase label once payment is ready", () => {
    expect(getCheckoutSubmitPresentation(readyTrial)).toEqual({
      label: "Start my 14-day free trial",
      status: null,
    });
  });

  it("does not describe an errored checkout as loading", () => {
    expect(
      getCheckoutSubmitPresentation({
        ...readyTrial,
        checkoutError: "Payment fields could not load",
        paymentLoading: true,
      }),
    ).toEqual({
      label: "Payment unavailable",
      status: null,
    });
  });
});
