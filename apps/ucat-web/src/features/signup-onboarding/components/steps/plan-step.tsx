"use client";

import { useState } from "react";
import { founderInvitationCode } from "@/features/founder-offers/lib/invitation-path";
import { rememberInvitation } from "@/features/founder-offers/lib/pending-invitation";
import { InvitationCodeEntry } from "@/features/founder-offers/components/invitation-code-entry";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@altitutor/ui";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { ReferralGiftCard } from "@/features/subscription/components/referral-gift-card";
import { fetchReferralGifts } from "@/features/subscription/api/referral-gifts";

type SignupCompletePlanStepProps = {
  onComplete: () => void;
  onContinueCurrentPlan: () => void;
  returnTo: string;
  onGiftReady?: (available: boolean) => void;
};

export function SignupCompletePlanStep({
  onComplete,
  onContinueCurrentPlan,
  returnTo,
  onGiftReady,
}: SignupCompletePlanStepProps) {
  const queryClient = useQueryClient();
  const code = founderInvitationCode(returnTo);
  const [choosingPlan, setChoosingPlan] = useState(false);
  const continueFree = () => {
    rememberInvitation(null);
    onComplete();
  };
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
  });

  if (code && !choosingPlan) {
    return (
      <InvitationCodeEntry
        initialCode={code}
        presentation="gift"
        onOfferLoaded={onGiftReady}
        onDeclined={continueFree}
        onCodeApplied={() => setChoosingPlan(true)}
      />
    );
  }

  if (!code && giftQuery.isLoading) {
    return <Skeleton className="h-72 w-full rounded-3xl" />;
  }

  if (!code && giftQuery.data?.pendingGift) {
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
      invitationCode={code ?? undefined}
      showInvitationEntry={!code}
      surfaceTheme="app"
      selectorTheme="app"
      checkoutReturnContext="signup_onboarding"
      postCheckoutReturnTo={returnTo}
      onContinueFree={continueFree}
      onContinueCurrentPlan={onContinueCurrentPlan}
    />
  );
}
