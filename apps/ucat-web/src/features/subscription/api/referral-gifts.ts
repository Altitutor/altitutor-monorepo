export type PendingReferralGift = {
  id: string;
  duration: "week" | "month";
  expiresAt: string;
  referrerName: string;
};

export type EarnedReferralGift = {
  id: string;
  duration_interval: "week" | "month";
  status: "available" | "checkout_pending";
  created_at: string;
};

export type ReferralGiftInbox = {
  pendingGift: PendingReferralGift | null;
  earnedGifts: EarnedReferralGift[];
};

export async function fetchReferralGifts(): Promise<ReferralGiftInbox> {
  const response = await fetch("/api/ucat/referrals/gift", {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Failed to load referral gifts");
  return response.json() as Promise<ReferralGiftInbox>;
}

export async function rejectReferralGift(referralId: string): Promise<void> {
  const response = await fetch("/api/ucat/referrals/gift", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "reject", referralId }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {
      error?: string;
    };
    throw new Error(body.error ?? "Failed to reject referral gift");
  }
}
