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
  return body;
}
