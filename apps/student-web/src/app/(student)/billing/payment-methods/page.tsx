"use client";

import { PaymentMethodCard } from "@/features/billing/components/PaymentMethodCard";
import { usePreWarmBilling } from "@/features/billing/hooks/usePreWarmBilling";

export default function BillingPaymentMethodsPage() {
  usePreWarmBilling();

  return (
    <div id="tour-billing-payment-method" className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold">Payment methods</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the card used for automatic billing.
        </p>
      </div>
      <PaymentMethodCard />
    </div>
  );
}
