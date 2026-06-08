"use client";

import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { upgradePlanPickerTiers } from "@/features/subscription/lib/plan-tier-rank";

type PlanUpgradeUpsellProps = {
  subscriptionPlanTier?: string | null;
};

export function PlanUpgradeUpsell({
  subscriptionPlanTier,
}: PlanUpgradeUpsellProps) {
  const access = useUcatAccess();
  const visibleTiers = upgradePlanPickerTiers(
    access.onlineTier,
    subscriptionPlanTier,
  );

  if (access.isLoading || visibleTiers.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold tracking-tight">Upgrade your plan</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Unlock more access and benefits with a higher tier.
        </p>
      </div>
      <PlanPicker
        variant="page"
        surfaceTheme="app"
        layout="horizontal"
        visibleTiers={visibleTiers}
      />
    </section>
  );
}
