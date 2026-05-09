'use client';

import { BillingSubsidiesSection, PaymentMethodCard, InvoicesTable, SubscriptionsSection } from '@/features/billing/components';
import { usePreWarmBilling } from '@/features/billing/hooks/usePreWarmBilling';
import { StudentPageContainer } from '@/shared/components/layouts';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function BillingPage() {
  // Pre-warm Stripe.js and setup intent when page loads
  usePreWarmBilling();

  return (
    <StudentPageContainer className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
        <p className="text-muted-foreground mt-1">
          Manage your payment methods and view invoices
        </p>
      </div>

      <BillingSubsidiesSection />

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Payment Method</h2>
        <PaymentMethodCard />
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <InvoicesTable />
      </div>

      <SubscriptionsSection />
    </StudentPageContainer>
  );
}

