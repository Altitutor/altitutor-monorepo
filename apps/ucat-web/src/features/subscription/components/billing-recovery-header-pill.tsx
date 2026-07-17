"use client";

import { AlertTriangle, CreditCard } from "lucide-react";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import { HeaderStatusPill } from "@/shared/components/header-status-pill";

export function BillingRecoveryHeaderPill() {
  const { data, isLoading } = useUcatSubscriptionBilling();
  const status = data?.subscription?.status;

  if (isLoading || (status !== "past_due" && status !== "unpaid")) {
    return null;
  }

  const pastDue = status === "past_due";
  return (
    <HeaderStatusPill
      variant={pastDue ? "amber" : "rose"}
      icon={
        pastDue ? (
          <CreditCard className="h-3.5 w-3.5" />
        ) : (
          <AlertTriangle className="h-3.5 w-3.5" />
        )
      }
      action={{
        type: "link",
        href: "/settings/plan/subscription",
        label: pastDue ? "Fix payment" : "Review plan",
      }}
    >
      <span className="font-medium">
        {pastDue ? "Payment needs attention" : "Paid plan ended"}
      </span>
    </HeaderStatusPill>
  );
}
