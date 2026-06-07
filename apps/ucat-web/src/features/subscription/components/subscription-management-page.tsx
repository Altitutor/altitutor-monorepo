"use client";

import { QuotaUsageCard } from "@/features/ucat-access/components/quota-usage-card";
import { UcatPageHeader } from "@/features/layout";
import { SubscriptionBillingSection } from "@/features/subscription/components/subscription-billing-section";

export function SubscriptionManagementPage() {
  return (
    <div className="space-y-6">
      <UcatPageHeader
        title="Subscription"
        description="View your UCAT online subscription and billing history."
      />

      <QuotaUsageCard />

      <SubscriptionBillingSection />
    </div>
  );
}
