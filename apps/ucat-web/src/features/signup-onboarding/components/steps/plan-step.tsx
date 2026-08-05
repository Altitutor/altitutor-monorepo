"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@altitutor/ui";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { ReferralGiftCard } from "@/features/subscription/components/referral-gift-card";
import { fetchReferralGifts } from "@/features/subscription/api/referral-gifts";

type SignupCompletePlanStepProps = {
  onComplete: () => void;
  onContinueCurrentPlan: () => void;
  returnTo: string;
};

export function SignupCompletePlanStep({
  onComplete,
  onContinueCurrentPlan,
  returnTo,
}: SignupCompletePlanStepProps) {
  const queryClient = useQueryClient();
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
  });

  if (giftQuery.isLoading) {
    return <Skeleton className="h-72 w-full rounded-3xl" />;
  }

  if (giftQuery.data?.pendingGift) {
    return (
      <ReferralGiftCard
        gift={giftQuery.data.pendingGift}
        checkoutContext="signup_onboarding"
        postCheckoutReturnTo={returnTo}
        onRejected={async () => {
          await queryClient.invalidateQueries({
            queryKey: ["ucat-referral-gifts"],
          });
          onComplete();
        }}
      />
    );
  }

  return (
    <PlanPicker
      variant="onboarding"
      surfaceTheme="app"
      selectorTheme="app"
      checkoutReturnContext="signup_onboarding"
      postCheckoutReturnTo={returnTo}
      onContinueFree={onComplete}
      onContinueCurrentPlan={onContinueCurrentPlan}
    />
  );
}
