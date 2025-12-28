'use client';

import { useState } from 'react';
import { Button } from '@altitutor/ui';
import { CreditCard, Plus, Loader2 } from 'lucide-react';
import { usePaymentMethods } from '../hooks/usePaymentMethods';
import { AddPaymentMethodModal } from './AddPaymentMethodModal';
import { PaymentMethodsList } from './PaymentMethodsList';
import { useProfile } from '@/features/profile/hooks/useProfile';

export function PaymentMethodCard() {
  const { data: billing, isLoading } = usePaymentMethods();
  const { data: profile } = useProfile();
  const [isModalOpen, setIsModalOpen] = useState(false);

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaymentMethodCard.tsx:12',message:'Component render',data:{isLoading,hasBilling:!!billing,hasProfile:!!profile,billingKeys:billing?Object.keys(billing):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B'})}).catch(()=>{});
  // #endregion

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaymentMethodCard.tsx:28',message:'Before parsing payment_methods',data:{hasBilling:!!billing,hasPaymentMethodsField:!!billing?.payment_methods,paymentMethodsType:billing?.payment_methods?typeof billing.payment_methods:null,isArray:Array.isArray(billing?.payment_methods),paymentMethodsPreview:billing?.payment_methods?JSON.stringify(billing.payment_methods).substring(0,300):null},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'B,C'})}).catch(()=>{});
  // #endregion

  // Handle payment_methods - should already be transformed to array by API layer
  const paymentMethods = billing?.payment_methods ?? [];
  
  // Debug logging
  if (process.env.NODE_ENV === 'development') {
    console.log('[PaymentMethodCard] Billing data:', billing);
    console.log('[PaymentMethodCard] Payment methods:', paymentMethods);
  }
  
  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/03d835b2-9f2b-42e2-a795-53809de736bc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'PaymentMethodCard.tsx:58',message:'Final payment methods state',data:{finalLength:paymentMethods.length,hasPaymentMethods:paymentMethods.length>0,studentId},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'A,B,C,D,E'})}).catch(()=>{});
  // #endregion
  
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

