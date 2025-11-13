'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { PaymentMethodsList } from './PaymentMethodsList';
import { useAuthStore } from '@/shared/lib/supabase/auth';

export function PaymentMethodCard() {
  const { data: billing, isLoading } = usePaymentMethods();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { user } = useAuthStore();

  // Get student ID from user metadata (more reliable than waiting for billing data)
  // Fallback to billing data if user metadata is not available
  const studentId = user?.user_metadata?.student_id || billing?.student_id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle payment_methods - could be array or JSON string from database
  let paymentMethods: any[] = [];
  if (billing?.payment_methods) {
    if (Array.isArray(billing.payment_methods)) {
      paymentMethods = billing.payment_methods;
    } else if (typeof billing.payment_methods === 'string') {
      try {
        paymentMethods = JSON.parse(billing.payment_methods);
      } catch {
        paymentMethods = [];
      }
    }
  }
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[PaymentMethodCard] Billing data:', billing);
    console.log('[PaymentMethodCard] Payment methods:', paymentMethods);
  }
  
  const hasPaymentMethods = paymentMethods.length > 0;

  return (
    <div className="space-y-4">
      {hasPaymentMethods ? (
        <>
          <PaymentMethodsList paymentMethods={paymentMethods} />
          <Button 
            onClick={() => setIsModalOpen(true)} 
            variant="outline" 
            className="w-full"
            disabled={!studentId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Another Payment Method
          </Button>
        </>
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
          <Button 
            onClick={() => setIsModalOpen(true)}
            disabled={!studentId}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      )}

      {/* Always render modal, but it will handle missing studentId internally */}
      <AddPaymentMethodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        studentId={studentId || ''}
      />
    </div>
  );
}

