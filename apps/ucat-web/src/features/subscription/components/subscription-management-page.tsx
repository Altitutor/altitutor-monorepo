"use client";

import { motion } from "motion/react";
import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { UcatPageHeader } from "@/features/layout";
import { SubscriptionBillingSection } from "@/features/subscription/components/subscription-billing-section";
import { useUcatStaggerMotion } from "@/shared/hooks/use-ucat-stagger-motion";

export function SubscriptionManagementPage() {
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
          title="Subscription"
          description="View your UCAT online subscription and billing history."
        />
      </motion.div>

      <motion.div variants={itemVariants}>
        <QuotaUsageCard />
      </motion.div>

      <motion.div variants={itemVariants}>
        <SubscriptionBillingSection />
      </motion.div>
    </motion.div>
  );
}
