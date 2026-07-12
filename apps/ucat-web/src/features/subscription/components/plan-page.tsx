"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { UcatPageHeader } from "@/features/layout";
import { CurrentPlanSection } from "@/features/subscription/components/current-plan-section";
import { SubscriptionBillingSection } from "@/features/subscription/components/subscription-billing-section";
import { ReferralSection } from "@/features/subscription/components/referral-section";
import { SegmentedControl } from "@/features/progress/components/segmented-control";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

type PlanPageTab = "current" | "subscription" | "referrals";

type PlanPageProps = {
  defaultTab?: PlanPageTab;
};

export function PlanPage({ defaultTab = "current" }: PlanPageProps) {
  const [tab, setTab] = useState<PlanPageTab>(defaultTab);
  const { containerVariants, itemVariants } = useUcatStaggerMotion();

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
          options={[
            { value: "current", label: "Current plan" },
            { value: "subscription", label: "Subscription" },
            { value: "referrals", label: "Refer friends" },
          ]}
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
