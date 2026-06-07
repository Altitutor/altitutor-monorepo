"use client";

import { useState } from "react";
import { UcatPageHeader } from "@/features/layout";
import { CurrentPlanSection } from "@/features/subscription/components/current-plan-section";
import { SubscriptionBillingSection } from "@/features/subscription/components/subscription-billing-section";
import { SegmentedControl } from "@/features/progress/components/segmented-control";

type PlanPageTab = "current" | "subscription";

type PlanPageProps = {
  defaultTab?: PlanPageTab;
};

export function PlanPage({ defaultTab = "current" }: PlanPageProps) {
  const [tab, setTab] = useState<PlanPageTab>(defaultTab);

  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Plan"
        description="Your current plan, benefits, and billing."
        backHref="/settings"
      />

      <SegmentedControl<PlanPageTab>
        value={tab}
        onValueChange={setTab}
        options={[
          { value: "current", label: "Current plan" },
          { value: "subscription", label: "Subscription" },
        ]}
      />

      {tab === "current" ? <CurrentPlanSection /> : <SubscriptionBillingSection />}
    </div>
  );
}
