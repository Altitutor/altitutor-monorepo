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
