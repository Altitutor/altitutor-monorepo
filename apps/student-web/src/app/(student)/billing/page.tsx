'use client';

import { BillingSubsidiesSection, PaymentMethodCard, InvoicesTable } from '@/features/billing/components';
import { usePreWarmBilling } from '@/features/billing/hooks/usePreWarmBilling';

// Mark this page as dynamic to prevent static generation
// This page requires Supabase client which needs environment variables
export const dynamic = 'force-dynamic';

export default function BillingPage() {
  // Pre-warm Stripe.js and setup intent when page loads
  usePreWarmBilling();

  return (
    <div className="p-6 space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
        <p className="text-muted-foreground mt-1">
          Manage your payment methods and view invoices
        </p>
      </div>

      <BillingSubsidiesSection />
      
      {/* Payment Method Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Payment Method</h2>
        <PaymentMethodCard />
      </div>
      
      {/* Invoices Section */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Invoices</h2>
        <InvoicesTable />
      </div>
    </div>
  );
}

