import type { EarnedReferralGift } from "@/features/subscription/api/referral-gifts";
import type { ReferralGiftDuration } from "@/features/subscription/lib/referral-offer-copy";

export type AvailableRewardDisplay = {
  title: string;
  detail: string;
  extra: string | null;
  cta: { label: string; href: string } | null;
  usedCount: number;
};

function pluralizePeriod(count: number, duration: ReferralGiftDuration): string {
  if (count === 1) return `1 free ${duration}`;
  return `${count} free ${duration}s`;
}

function billRewardDuration(
  billingInterval: string | null | undefined,
): ReferralGiftDuration {
  return billingInterval === "month" || billingInterval === "year"
    ? "month"
    : "week";
}

function checkoutHrefForGift(gift: EarnedReferralGift): string {
  const duration =
    gift.duration_interval === "month" ? "month" : ("week" as const);
  const params = new URLSearchParams({
    tier: "unlimited",
    interval: duration,
    context: "referral_gift",
    gift: gift.id,
  });
  return `/checkout?${params.toString()}`;
}

type BuildAvailableRewardDisplayArgs = {
  earnedGifts: EarnedReferralGift[];
  queuedFreeBills: number;
  usedCount: number;
  billingInterval: string | null | undefined;
  planLabel: "Unlimited";
};

/**
 * Prefer redeemable Unlimited access gifts (Free referrers). Otherwise describe
 * queued free-bill rewards for paid referrers using their current cadence.
 */
export function buildAvailableRewardDisplay({
  earnedGifts,
  queuedFreeBills,
  usedCount,
  billingInterval,
  planLabel,
}: BuildAvailableRewardDisplayArgs): AvailableRewardDisplay {
  if (earnedGifts.length > 0) {
    const nextGift = earnedGifts[0]!;
    const nextDuration: ReferralGiftDuration =
      nextGift.duration_interval === "month" ? "month" : "week";
    const matchingCount = earnedGifts.filter(
      (gift) =>
        (gift.duration_interval === "month" ? "month" : "week") ===
        nextDuration,
    ).length;
    const remainingOther = earnedGifts.length - matchingCount;

    return {
      title: pluralizePeriod(matchingCount, nextDuration),
      detail: "of UCAT Unlimited · ready to start",
      extra:
        remainingOther > 0
          ? `${remainingOther} more reward${remainingOther === 1 ? "" : "s"} waiting`
          : queuedFreeBills > 0
            ? `${queuedFreeBills} free bill${queuedFreeBills === 1 ? "" : "s"} queued`
            : null,
      cta: {
        label: `Use free ${nextDuration}`,
        href: checkoutHrefForGift(nextGift),
      },
      usedCount,
    };
  }

  if (queuedFreeBills > 0) {
    const duration = billRewardDuration(billingInterval);
    return {
      title: pluralizePeriod(queuedFreeBills, duration),
      detail:
        billingInterval === "year"
          ? `credit on your ${planLabel} plan · applies on your next bill`
          : `of your ${planLabel} plan · applies on your next bill`,
      extra: null,
      cta: null,
      usedCount,
    };
  }

  return {
    title: "None ready",
    detail: "Earn rewards when a friend accepts your gift",
    extra: null,
    cta: null,
    usedCount,
  };
}
