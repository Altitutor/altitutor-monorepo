import { useState } from "react";
import { Share, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  Action,
  Copy,
  Failure,
  Group,
  Loading,
  Screen,
  useColors,
} from "@/components/ui";
import { api, webUrl } from "@/lib/api";
import type { UcatReferralSummary } from "@/features/subscription/api/referrals";
import type { ReferralGiftInbox } from "@/features/subscription/api/referral-gifts";
import type { UcatSubscriptionBillingResponse } from "@/features/subscription/types/ucat-subscription-billing";
import { resolveReferralOfferCopy } from "@/features/subscription/lib/referral-offer-copy";
import { buildAvailableRewardDisplay } from "@/features/subscription/lib/referral-rewards-display";
import { openWebSettings } from "@/features/settings/open-web-settings";

export default function Referrals() {
  const c = useColors();
  const [shareError, setShareError] = useState<Error | null>(null);
  const q = useQuery({
    queryKey: ["referral-summary"],
    queryFn: async () => {
      const [summary, gifts, billing] = await Promise.all([
        api<UcatReferralSummary>("/referrals"),
        api<ReferralGiftInbox>("/referrals/gift"),
        api<UcatSubscriptionBillingResponse>("/subscription/billing"),
      ]);
      return { summary, gifts, billing };
    },
  });
  if (q.isPending)
    return (
      <Screen>
        <Loading variant="card" count={2} />
      </Screen>
    );
  if (q.error)
    return (
      <Screen>
        <Failure error={q.error} retry={() => void q.refetch()} />
      </Screen>
    );
  const { summary, gifts, billing } = q.data;
  const offer = resolveReferralOfferCopy(billing.subscription);
  const rewards = buildAvailableRewardDisplay({
    earnedGifts: gifts.earnedGifts,
    queuedFreeBills: summary.stats.queuedFreeBills,
    usedCount: summary.stats.usedFreePeriods + summary.stats.redeemedFreeBills,
    billingInterval: billing.subscription?.billing_interval,
    planLabel: "Unlimited",
  });
  const url = new URL(webUrl("/signup"));
  url.searchParams.set("ref", summary.code);
  const share = async () => {
    setShareError(null);
    try {
      await Share.share(
        process.env.EXPO_OS === "ios"
          ? {
              title: "Try Altitutor UCAT",
              message: "Join me on Altitutor for UCAT practice.",
              url: url.toString(),
            }
          : {
              title: "Try Altitutor UCAT",
              message: `Join me on Altitutor for UCAT practice. ${url}`,
            },
      );
    } catch (error) {
      setShareError(
        error instanceof Error ? error : new Error("Unable to share link"),
      );
    }
  };
  return (
    <Screen>
      <Group>
        <Copy large>{offer.headline}</Copy>
        <Copy muted>{offer.description}</Copy>
        {offer.steps.map((step) => (
          <Copy key={step.step}>
            {step.step}. {step.title} — {step.description}
          </Copy>
        ))}
        <Text selectable style={{ color: c.accent, fontSize: 15 }}>
          {url.toString()}
        </Text>
        <Action title="Share referral link" onPress={() => void share()} />
        {shareError && <Failure error={shareError} />}
      </Group>
      {gifts.pendingGift && (
        <Group title="Your gift">
          <Copy>
            A free {gifts.pendingGift.duration} from{" "}
            {gifts.pendingGift.referrerName}
          </Copy>
          <Action
            title="View gift"
            onPress={() => void openWebSettings("/settings/plan/referrals")}
          />
        </Group>
      )}
      <Group title="Referral activity">
        <Copy large>{summary.stats.friendsJoined}</Copy>
        <Copy muted>
          {summary.stats.friendsJoined === 1
            ? "friend joined"
            : "friends joined"}
        </Copy>
      </Group>
      <Group title="Available rewards">
        <Copy large>{rewards.title}</Copy>
        <Copy muted>{rewards.detail}</Copy>
        {rewards.extra && <Copy muted>{rewards.extra}</Copy>}
        {rewards.cta && (
          <Action
            title="View rewards"
            onPress={() => void openWebSettings("/settings/plan/referrals")}
          />
        )}
        <Copy muted>Already used: {rewards.usedCount}</Copy>
      </Group>
    </Screen>
  );
}
