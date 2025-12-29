'use client';

import { useState } from 'react';
import type { Tables, Database } from '@altitutor/shared';
import { Button } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AddPaymentMethodModal } from '@/features/billing/components/AddPaymentMethodModal';
import { Plus, CreditCard } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentMethodCard, type PaymentMethodCardData } from '@altitutor/ui';
import { paymentMethodsApi } from '@/features/billing/api/payment-methods';

type PaymentMethod = Tables<'student_payment_methods'>;

// Query key factory for student payment methods
export const studentPaymentMethodsKeys = {
  all: ['student-payment-methods'] as const,
  student: (studentId: string) => [...studentPaymentMethodsKeys.all, studentId] as const,
};

async function fetchStudentPaymentMethods(studentId: string): Promise<PaymentMethod[]> {
  const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
    .from('student_payment_methods')
    .select('*')
    .eq('student_id', studentId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });
  
  if (error) throw error;
  return data || [];
}

export function StudentBillingTab({ student }: { student: Tables<'students'> }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: paymentMethods = [], isLoading: loading } = useQuery({
    queryKey: studentPaymentMethodsKeys.student(student.id),
    queryFn: () => fetchStudentPaymentMethods(student.id),
  });

  const handleSetDefault = async (methodId: string) => {
    try {
      await paymentMethodsApi.setDefaultPaymentMethod(methodId, student.id);
      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });
      // Invalidate and refetch the query
      queryClient.invalidateQueries({ queryKey: studentPaymentMethodsKeys.student(student.id) });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to set default payment method',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveMethod = async (methodId: string) => {
    const method = paymentMethods.find(m => m.id === methodId);
    if (!method) return;

    if (method.is_default) {
      toast({
        title: 'Error',
        description: 'Cannot remove default payment method. Please set a different card as default first.',
        variant: 'destructive',
      });
      return;
    }

    if (!confirm('Remove this payment method?')) return;

    try {
      await paymentMethodsApi.deletePaymentMethod(methodId, student.id);
      toast({
        title: 'Success',
        description: 'Payment method removed',
      });
      // Invalidate and refetch the query
      queryClient.invalidateQueries({ queryKey: studentPaymentMethodsKeys.student(student.id) });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to remove payment method',
        variant: 'destructive',
      });
    }
  };

  const handleAddSuccess = async () => {
    // Poll for the new payment method - webhook may take a moment
    let attempts = 0;
    const maxAttempts = 10;
    const pollInterval = 500; // 500ms between attempts
    
    const poll = async () => {
      attempts++;
      await queryClient.refetchQueries({ queryKey: studentPaymentMethodsKeys.student(student.id) });
      
      if (attempts < maxAttempts) {
        setTimeout(poll, pollInterval);
      }
    };
    
    // Start polling after initial delay
    setTimeout(poll, 1000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          View and manage the student's saved payment methods.
        </div>
        <Button onClick={() => setIsModalOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      {loading ? (
        <div>Loading…</div>
      ) : paymentMethods.length === 0 ? (
        <div className="text-center py-8 space-y-4">
          <div className="flex justify-center">
            <div className="p-4 bg-muted rounded-full">
              <CreditCard className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
          <div className="space-y-2">
            <h3 className="font-semibold">No payment method on file</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Add a payment method to enable automatic billing for sessions
            </p>
          </div>
          <Button onClick={() => setIsModalOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Payment Method
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paymentMethods.map((method) => {
            const cardData: PaymentMethodCardData = {
              id: method.id,
              card_brand: method.card_brand,
              card_last4: method.card_last4,
              card_exp_month: method.card_exp_month,
              card_exp_year: method.card_exp_year,
              is_default: method.is_default,
            };

            return (
              <PaymentMethodCard
                key={method.id}
                paymentMethod={cardData}
                onSetDefault={handleSetDefault}
                onDelete={handleRemoveMethod}
                showActions={true}
              />
            );
          })}
        </div>
      )}

      <AddPaymentMethodModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        studentId={student.id}
        studentEmail={student.email || undefined}
        studentName={student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : undefined}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}



