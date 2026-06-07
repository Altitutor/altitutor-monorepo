"use client";

import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@altitutor/ui";
import { completeUcatOnboarding } from "@/features/ucat-access/api/complete-onboarding";
import { useQuotaLimitModal } from "@/features/ucat-access/context/quota-limit-context";
import { useQuotaUsage } from "@/features/ucat-access/hooks/use-quota-usage";
import { formatQuotaPeriodLabel } from "@/features/ucat-access/lib/format-quota-period";
import { UCAT_QUOTA_AREA_LABELS } from "@/features/ucat-access/types/quota";
import { createUcatCheckoutSession } from "@/features/subscription/api/create-checkout";

export function QuotaLimitModal() {
  const router = useRouter();
  const { open, payload, closeQuotaLimit } = useQuotaLimitModal();
  const { data: quotaUsage } = useQuotaUsage();

  if (!payload) return null;

  const areaLabel = UCAT_QUOTA_AREA_LABELS[payload.area];
  const periodLabel = formatQuotaPeriodLabel(payload.period);
  const proTrialEligible = quotaUsage?.proTrialEligible ?? false;
  const isDisabled = payload.limit === 0;

  const handlePrimary = async () => {
    closeQuotaLimit();
    if (proTrialEligible) {
      try {
        await completeUcatOnboarding("pro_trial");
        const { url } = await createUcatCheckoutSession();
        window.location.href = url;
      } catch {
        router.push("/subscribe");
      }
      return;
    }
    router.push("/subscribe");
  };

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) closeQuotaLimit();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isDisabled
              ? `${areaLabel} not included on UCAT Free`
              : `${areaLabel} limit reached`}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isDisabled
              ? `${areaLabel} is not available on UCAT Free. Upgrade to UCAT Pro for unlimited access across Learn, Practice, Sets, Mocks, and Skill trainer.`
              : `You've used ${payload.used} of ${payload.limit} ${areaLabel.toLowerCase()} ${periodLabel} on UCAT Free. Upgrade to UCAT Pro for unlimited access.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={closeQuotaLimit}>
            Maybe later
          </AlertDialogAction>
          <AlertDialogAction onClick={() => void handlePrimary()}>
            {proTrialEligible ? "Start Pro trial" : "Subscribe"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
