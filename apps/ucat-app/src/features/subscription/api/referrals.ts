export type UcatReferralSummary = {
  code: string;
  stats: {
    friendsJoined: number;
    giftsAccepted: number;
    giftsPending: number;
    availableFreePeriods: number;
    usedFreePeriods: number;
    queuedFreeBills: number;
    redeemedFreeBills: number;
    /** True when a full free-bill referral reward will cover the next invoice. */
    nextBillFreeFromReferral: boolean;
  };
};
