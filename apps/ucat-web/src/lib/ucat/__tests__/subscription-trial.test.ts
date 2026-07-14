import { isStandardUcatTrialEligible } from "@/lib/ucat/subscription-trial";

const ELIGIBLE = {
  trialConsumedAt: null,
  hasPriorUcatSubscription: false,
  hasAcceptedRecipientGift: false,
  hasReferralAccessGift: false,
} as const;

describe("isStandardUcatTrialEligible", () => {
  it("allows a first-time student without a referral benefit", () => {
    expect(isStandardUcatTrialEligible(ELIGIBLE)).toBe(true);
  });

  it.each([
    { trialConsumedAt: "2026-07-14T00:00:00.000Z" },
    { hasPriorUcatSubscription: true },
    { hasAcceptedRecipientGift: true },
    { hasReferralAccessGift: true },
  ])(
    "rejects students who already used an acquisition benefit: %o",
    (input) => {
      expect(isStandardUcatTrialEligible({ ...ELIGIBLE, ...input })).toBe(
        false,
      );
    },
  );
});
