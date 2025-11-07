'use client';

import { useState } from 'react';
import { Card, CardContent } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { useBilling } from '../hooks';
import { formatDate } from '@/shared/utils';

export function PaymentMethodCard() {
  const { data: billing, isLoading } = useBilling();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdatePaymentMethod = async () => {
    setIsUpdating(true);
    // TODO: Implement payment method update flow
    // This will involve creating a Stripe setup intent and opening the payment modal
    console.log('Update payment method clicked');
    setIsUpdating(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPaymentMethod = billing?.stripe_payment_method_id;

  return (
    <div className="space-y-4">
      {hasPaymentMethod ? (
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-muted rounded-lg">
              <CreditCard className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">
                  {billing.stripe_payment_method_brand?.toUpperCase() || 'Card'} 
                  {billing.stripe_payment_method_last4 && ` •••• ${billing.stripe_payment_method_last4}`}
                </p>
                {billing.stripe_payment_method_verified_at && (
                  <Badge variant="outline" className="text-xs">
                    Verified
                  </Badge>
                )}
              </div>
              {billing.stripe_payment_method_verified_at && (
                <p className="text-sm text-muted-foreground">
                  Verified on {formatDate(billing.stripe_payment_method_verified_at)}
                </p>
              )}
            </div>
          </div>
          <Button
            variant="outline"
            onClick={handleUpdatePaymentMethod}
            disabled={isUpdating}
          >
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Update
          </Button>
        </div>
      ) : (
        <div className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-muted rounded-full">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">No payment method on file</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add a payment method to enable automatic billing for your sessions
            </p>
          </div>
          <Button onClick={handleUpdatePaymentMethod} disabled={isUpdating}>
            {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      )}
    </div>
  );
}

