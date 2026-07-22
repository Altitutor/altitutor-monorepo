import type { UcatSubscriptionDetails } from "@/features/subscription/types/ucat-subscription-billing";

export type ReferralGiftDuration = "week" | "month";

export type ReferralOfferCopy = {
  isPaidReferrer: boolean;
  giftDuration: ReferralGiftDuration;
  planLabel: "Unlimited";
  badge: string;
  headline: string;
  description: string;
  steps: Array<{ step: string; title: string; description: string }>;
};

type SubscriptionSnapshot = Pick<
  UcatSubscriptionDetails,
  "status" | "plan_tier" | "billing_interval"
> | null;

/**
 * Mirrors prepare_ucat_referral_gift_on_insert: only active/past_due Unlimited
 * count as paid referrers; gift length follows their billing cadence.
 */
export function resolveReferralOfferCopy(
  subscription: SubscriptionSnapshot,
): ReferralOfferCopy {
  const isPaidReferrer = Boolean(
    subscription &&
      (subscription.status === "active" || subscription.status === "past_due") &&
      subscription.plan_tier === "unlimited",
  );

  const giftDuration: ReferralGiftDuration =
    isPaidReferrer &&
    (subscription?.billing_interval === "month" ||
      subscription?.billing_interval === "year")
      ? "month"
      : "week";

  const planLabel = "Unlimited" as const;

  if (!isPaidReferrer) {
    return {
      isPaidReferrer: false,
      giftDuration: "week",
      planLabel: "Unlimited",
      badge: "Gift Unlimited",
      headline: "Give a free week of UCAT Unlimited.",
      description:
        "Share your link and your friend both get one free week of UCAT Unlimited.",
      steps: [
        {
          step: "1",
          title: "Share your link",
          description: "Send your personal link to a friend.",
        },
        {
          step: "2",
          title: "They choose",
          description:
            "They get one free week of UCAT Unlimited.",
        },
        {
          step: "3",
          title: "You earn",
          description:
            "If they accept, you both get a free week of Unlimited. If they instead continue with the Free plan, you both get a Free quota reset.",
        },
      ],
    };
  }

  return {
    isPaidReferrer: true,
    giftDuration,
    planLabel,
    badge: "Gift Unlimited",
    headline: `Give a free ${giftDuration} of UCAT Unlimited.`,
    description: `Your friend gets one free ${giftDuration} of Unlimited. When they accept, you earn a free ${giftDuration} of your ${planLabel} plan (your next bill free).`,
    steps: [
      {
        step: "1",
        title: "Share your link",
        description: "Send your personal link to a friend.",
      },
      {
        step: "2",
        title: "They choose",
        description: `They have 7 days to accept one free ${giftDuration} of Unlimited, or continue Free.`,
      },
      {
        step: "3",
        title: "You earn",
        description: `If they accept, you get a free ${giftDuration} of your ${planLabel} plan. If they continue Free, they get a Free quota reset.`,
      },
    ],
  };
}
