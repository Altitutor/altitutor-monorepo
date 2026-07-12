"use client";

import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { CurrentPlanSection } from "@/features/subscription/components/current-plan-section";
import { SubscriptionBillingSection } from "@/features/subscription/components/subscription-billing-section";
import { ReferralSection } from "@/features/subscription/components/referral-section";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { shouldShowSubscriptionTab } from "@/features/subscription/lib/should-show-subscription-tab";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { useUcatAccess } from "@/features/ucat-access/hooks/use-ucat-access";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type PlanPageTab = "current" | "subscription" | "referrals";

type PlanPageProps = {
  defaultTab?: PlanPageTab;
};

export function PlanPage({ defaultTab = "current" }: PlanPageProps) {
  const [tab, setTab] = useState<PlanPageTab>(defaultTab);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();
  const access = useUcatAccess();
  const { data: billing, isLoading: billingLoading } =
    useUcatSubscriptionBilling();

  const showSubscriptionTab = shouldShowSubscriptionTab({
    accessLoading: access.isLoading,
    billingLoading,
    onlineTier: access.onlineTier,
    subscriptionCount: billing?.subscriptions.length ?? 0,
    invoiceCount: billing?.invoices.length ?? 0,
  });

  useEffect(() => {
    if (!showSubscriptionTab && tab === "subscription") {
      setTab("current");
    }
  }, [showSubscriptionTab, tab]);

  const tabOptions = [
    { value: "current" as const, label: "Current plan" },
    ...(showSubscriptionTab
      ? [{ value: "subscription" as const, label: "Subscription" }]
      : []),
    { value: "referrals" as const, label: "Refer friends" },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={containerVariants}
      initial="hidden"
      animate="show"
    >
      <motion.div variants={itemVariants}>
        <UcatPageHeader
          title="Plan"
          description="Your current plan, benefits, and billing."
          backHref="/settings"
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <SegmentedControl<PlanPageTab>
          value={tab}
          onValueChange={setTab}
          options={tabOptions}
        />
      </motion.div>

      <motion.div variants={itemVariants} key={tab}>
        {tab === "current" ? (
          <CurrentPlanSection />
        ) : tab === "subscription" ? (
          <SubscriptionBillingSection />
        ) : (
          <ReferralSection />
        )}
      </motion.div>
    </motion.div>
  );
}
