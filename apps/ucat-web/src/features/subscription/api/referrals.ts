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

export async function fetchUcatReferralSummary(): Promise<UcatReferralSummary> {
  const response = await fetch("/api/ucat/referrals", { cache: "no-store" });
  const body = (await response.json().catch(() => ({}))) as
    | UcatReferralSummary
    | { error?: string };
  if (!response.ok || !("code" in body)) {
    throw new Error(
      "error" in body && body.error ? body.error : "Failed to load referrals",
    );
  }
  return {
    ...body,
    stats: {
      ...body.stats,
      nextBillFreeFromReferral: body.stats.nextBillFreeFromReferral === true,
    },
  };
}
