'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@altitutor/ui';
import { PaymentMethodCard, PaymentHistoryTable } from '@/features/billing/components';
import { usePreWarmBilling } from '@/features/billing/hooks/usePreWarmBilling';

export default function BillingPage() {
  // Pre-warm Stripe.js and setup intent when page loads
  usePreWarmBilling();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Billing & Payments</h1>
        <p className="text-muted-foreground mt-1">
          Manage your payment methods and view payment history
        </p>
      </div>
      
      {/* Payment Method Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment Method</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentMethodCard />
        </CardContent>
      </Card>
      
      {/* Payment History Section */}
      <Card>
        <CardHeader>
          <CardTitle>Payment History</CardTitle>
        </CardHeader>
        <CardContent>
          <PaymentHistoryTable />
        </CardContent>
      </Card>
    </div>
  );
}

