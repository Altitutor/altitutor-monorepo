"use client";

import { usePendingInvitation } from "@/features/founder-offers/lib/use-pending-invitation";
import { useRouter } from "next/navigation";
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
  const [code, setCode] = usePendingInvitation(founderInvitationCode(returnTo));
  const router = useRouter();
  const continueFree = () => {
    rememberInvitation(null);
    onComplete();
  };
  const giftQuery = useQuery({
    queryKey: ["ucat-referral-gifts"],
    queryFn: fetchReferralGifts,
  });

  if (code) {
    return (
      <InvitationCodeEntry
        initialCode={code}
        presentation="gift"
        onOfferLoaded={onGiftReady}
        onDeclined={continueFree}
        onCodeApplied={(offerCode) => {
          const params = new URLSearchParams({
            tier: "unlimited",
            interval: "month",
            context: "signup_onboarding",
            offer: offerCode,
            redirect: returnTo,
          });
          router.push(`/checkout?${params.toString()}`);
        }}
      />
    );
  }

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
      onInvitationSelected={setCode}
      variant="onboarding"
      surfaceTheme="app"
      selectorTheme="app"
      checkoutReturnContext="signup_onboarding"
      postCheckoutReturnTo={returnTo}
      onContinueFree={continueFree}
      onContinueCurrentPlan={onContinueCurrentPlan}
    />
  );
}
