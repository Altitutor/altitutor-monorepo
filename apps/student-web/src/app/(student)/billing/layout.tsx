import type { ReactNode } from "react";
import { StudentPageContainer } from "@/shared/components/layouts";

export default function BillingLayout({ children }: { children: ReactNode }) {
  return (
    <StudentPageContainer className="space-y-8">
      <div id="tour-billing-header">
        <h1 className="text-3xl font-bold tracking-tight">
          Billing & Payments
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage your payment methods, invoices, subscriptions, and subsidies
        </p>
      </div>
      {children}
    </StudentPageContainer>
  );
}
