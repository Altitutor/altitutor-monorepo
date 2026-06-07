"use client";

import { UcatPageHeader } from "@/features/layout";
import { PlanPicker } from "@/features/subscription/components/plan-picker/plan-picker";
import { CurrentPlanSection } from "@/features/subscription/components/current-plan-section";
import { SubscriptionInvoicesTable } from "@/features/subscription/components/subscription-invoices-table";
import { useUcatSubscriptionBilling } from "@/features/subscription/hooks/use-ucat-subscription-billing";
import {
  UCAT_SURFACE_CARD,
  UCAT_SURFACE_MOTION,
} from "@/lib/ucat-surface-motion";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export function PlanPage() {
  const { data, isLoading } = useUcatSubscriptionBilling();
  const invoices = data?.invoices ?? [];

  return (
    <div className="space-y-8">
      <UcatPageHeader
        title="Plan"
        description="Your current plan, benefits, and upgrade options."
        backHref="/settings"
      />

      <CurrentPlanSection />

      <section className="space-y-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Compare plans</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Upgrade or switch tiers. Billing interval is chosen at checkout and
            cannot be changed later.
          </p>
        </div>
        <PlanPicker variant="page" />
      </section>

      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : invoices.length > 0 ? (
        <section id="invoices" className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Invoices</h2>
          <div className={cn("rounded-ucatShell p-4", UCAT_SURFACE_CARD, UCAT_SURFACE_MOTION)}>
            <SubscriptionInvoicesTable invoices={invoices} />
          </div>
        </section>
      ) : null}
    </div>
  );
}
