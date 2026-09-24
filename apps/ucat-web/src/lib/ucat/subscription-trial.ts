export type StandardUcatTrialEligibilityInput = {
  trialConsumedAt: string | null;
  hasPriorUcatSubscription: boolean;
  hasAcceptedRecipientGift: boolean;
  hasReferralAccessGift: boolean;
};

/**
 * The standard trial and referral access gifts are mutually exclusive.
 * Rejected and expired recipient gifts are intentionally omitted so those
 * students can still use the standard trial if they otherwise qualify.
 */
export function isStandardUcatTrialEligible({
  trialConsumedAt,
  hasPriorUcatSubscription,
  hasAcceptedRecipientGift,
  hasReferralAccessGift,
}: StandardUcatTrialEligibilityInput): boolean {
  return (
    trialConsumedAt == null &&
    !hasPriorUcatSubscription &&
    !hasAcceptedRecipientGift &&
    !hasReferralAccessGift
  );
}
