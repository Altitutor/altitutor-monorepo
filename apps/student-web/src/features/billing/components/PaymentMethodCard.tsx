'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { PaymentMethodsList } from './PaymentMethodsList';
import { useProfile } from '@/shared/hooks';
import { studentBtnPrimary } from '@/shared/lib/student-visual';

export function PaymentMethodCard() {
  const { data: billing, isLoading } = usePaymentMethods();
  const { data: profile } = useProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Get student ID from billing view (primary) or profile view (fallback)
  // Both views return the student_id, so we should always have it once data loads
  const studentId = billing?.student_id || profile?.id;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Handle payment_methods - should already be transformed to array by API layer
  const paymentMethods = billing?.payment_methods ?? [];
  
  const hasPaymentMethods = paymentMethods.length > 0;

  return (
    <div className="space-y-4">
      {hasPaymentMethods ? (
        <PaymentMethodsList 
          paymentMethods={paymentMethods} 
          onAddPaymentMethod={studentId ? () => setIsModalOpen(true) : undefined}
        />
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
            className={studentBtnPrimary}
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

