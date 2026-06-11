'use client';

import { useState } from 'react';
import type { Tables, Database } from '@altitutor/shared';
import { Button, SegmentedTabPanel, SegmentedTabPanelContent } from '@altitutor/ui';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AddPaymentMethodModal } from '@/features/billing/components/AddPaymentMethodModal';
import { Plus } from 'lucide-react';
import { useToast } from '@altitutor/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { PaymentMethodCard, type PaymentMethodCardData } from '@altitutor/ui';
import { paymentMethodsApi } from '@/features/billing/api/payment-methods';
import { StudentInvoicesTable } from './StudentInvoicesTable';
import { CustomerBalanceSection } from './CustomerBalanceSection';
import { BillingPreferencesSection } from './BillingPreferencesSection';
import { StudentSubsidiesTable } from './StudentSubsidiesTable';
import { AddSubsidyModal } from './AddSubsidyModal';
import { fetchStudentSubsidies } from '../api/subsidies';
import { getErrorMessage } from '@/shared/utils';
import { StudentSubscriptionsTable } from './StudentSubscriptionsTable';

type PaymentMethod = Tables<'student_payment_methods'>;

// Query key factory for student payment methods
export const studentPaymentMethodsKeys = {
  all: ['student-payment-methods'] as const,
  student: (studentId: string) => [...studentPaymentMethodsKeys.all, studentId] as const,
};

// Query key factory for student subsidies
export const studentSubsidiesKeys = {
  all: ['student-subsidies'] as const,
  student: (studentId: string) => [...studentSubsidiesKeys.all, studentId] as const,
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

interface PaymentMethodsTabProps {
  student: Tables<'students'>;
}

function PaymentMethodsTab({ student }: PaymentMethodsTabProps) {
  const [isPaymentMethodModalOpen, setIsPaymentMethodModalOpen] = useState(false);
  const [loadingMethodId, setLoadingMethodId] = useState<string | null>(null);
  const [loadingAction, setLoadingAction] = useState<'setDefault' | 'delete' | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: paymentMethods = [], isLoading: loadingPaymentMethods } = useQuery({
    queryKey: studentPaymentMethodsKeys.student(student.id),
    queryFn: () => fetchStudentPaymentMethods(student.id),
  });

  const handleSetDefault = async (methodId: string) => {
    setLoadingMethodId(methodId);
    setLoadingAction('setDefault');
    try {
      await paymentMethodsApi.setDefaultPaymentMethod(methodId, student.id);
      toast({
        title: 'Success',
        description: 'Default payment method updated',
      });
      queryClient.invalidateQueries({ queryKey: studentPaymentMethodsKeys.student(student.id) });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to set default payment method',
        variant: 'destructive',
      });
    } finally {
      setLoadingMethodId(null);
      setLoadingAction(null);
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

    setLoadingMethodId(methodId);
    setLoadingAction('delete');
    try {
      await paymentMethodsApi.deletePaymentMethod(methodId, student.id);
      toast({
        title: 'Success',
        description: 'Payment method removed',
      });
      queryClient.invalidateQueries({ queryKey: studentPaymentMethodsKeys.student(student.id) });
    } catch (error: unknown) {
      const errorMessage = getErrorMessage(error);
      toast({
        title: 'Error',
        description: errorMessage || 'Failed to remove payment method',
        variant: 'destructive',
      });
    } finally {
      setLoadingMethodId(null);
      setLoadingAction(null);
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
        <h3 className="text-lg font-semibold">Payment Methods</h3>
        <Button onClick={() => setIsPaymentMethodModalOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Payment Method
        </Button>
      </div>

      {loadingPaymentMethods ? (
        <div className="text-center py-8 text-muted-foreground">Loading…</div>
      ) : paymentMethods.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No payment methods configured for this student
        </div>
      ) : (
        <div className="flex flex-wrap gap-4">
          {paymentMethods.map((method) => {
            const cardData: PaymentMethodCardData = {
              id: method.id,
              card_brand: method.card_brand,
              card_last4: method.card_last4,
              card_exp_month: method.card_exp_month,
              card_exp_year: method.card_exp_year,
              is_default: method.is_default,
            };

            const isDeleting = loadingMethodId === method.id && loadingAction === 'delete';
            const isSettingDefault = loadingMethodId === method.id && loadingAction === 'setDefault';

            return (
              <PaymentMethodCard
                key={method.id}
                paymentMethod={cardData}
                isDeleting={isDeleting}
                isSettingDefault={isSettingDefault}
                onSetDefault={handleSetDefault}
                onDelete={handleRemoveMethod}
                showActions={true}
              />
            );
          })}
        </div>
      )}

      <AddPaymentMethodModal
        isOpen={isPaymentMethodModalOpen}
        onClose={() => setIsPaymentMethodModalOpen(false)}
        studentId={student.id}
        studentEmail={student.email || undefined}
        studentName={student.first_name && student.last_name ? `${student.first_name} ${student.last_name}` : undefined}
        onSuccess={handleAddSuccess}
      />
    </div>
  );
}

interface InvoicesTabProps {
  studentId: string;
  studentName: string;
}

function InvoicesTab({ studentId, studentName }: InvoicesTabProps) {
  return (
    <div className="space-y-6">
      <CustomerBalanceSection studentId={studentId} studentName={studentName} />
      <div className="space-y-4">
        <StudentInvoicesTable studentId={studentId} />
      </div>
    </div>
  );
}

interface BillingPreferencesTabProps {
  student: Tables<'students'>;
}

function BillingPreferencesTab({ student }: BillingPreferencesTabProps) {
  return <BillingPreferencesSection student={student} />;
}

interface SubsidiesTabProps {
  studentId: string;
}

interface SubscriptionsTabProps {
  studentId: string;
}

function SubscriptionsTab({ studentId }: SubscriptionsTabProps) {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Subscriptions</h3>
      <StudentSubscriptionsTable studentId={studentId} />
    </div>
  );
}

function SubsidiesTab({ studentId }: SubsidiesTabProps) {
  const [isAddSubsidyModalOpen, setIsAddSubsidyModalOpen] = useState(false);
  const { data: subsidies = [], isLoading } = useQuery({
    queryKey: studentSubsidiesKeys.student(studentId),
    queryFn: () => fetchStudentSubsidies(studentId),
  });

  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Subsidies</h3>
        <Button onClick={() => setIsAddSubsidyModalOpen(true)} size="sm">
          <Plus className="mr-2 h-4 w-4" />
          Add Subsidy
        </Button>
      </div>
      <StudentSubsidiesTable subsidies={subsidies} studentId={studentId} />
      <AddSubsidyModal
        isOpen={isAddSubsidyModalOpen}
        onClose={() => setIsAddSubsidyModalOpen(false)}
        studentId={studentId}
      />
    </div>
  );
}

export function StudentBillingTab({ student }: { student: Tables<'students'> }) {
  const studentName = `${student.first_name} ${student.last_name}`;
  const [activeTab, setActiveTab] = useState('invoices');

  return (
    <SegmentedTabPanel
      value={activeTab}
      onValueChange={setActiveTab}
      className="w-full"
      options={[
        { value: 'invoices', label: 'Invoices' },
        { value: 'payment-methods', label: 'Payment Methods' },
        { value: 'subscriptions', label: 'Subscriptions' },
        { value: 'subsidies', label: 'Subsidies' },
        { value: 'billing-preferences', label: 'Billing Preferences' },
      ]}
    >
      <SegmentedTabPanelContent when="invoices" activeTab={activeTab} className="mt-6">
        <InvoicesTab studentId={student.id} studentName={studentName} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="payment-methods" activeTab={activeTab} className="mt-6">
        <PaymentMethodsTab student={student} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="subscriptions" activeTab={activeTab} className="mt-6">
        <SubscriptionsTab studentId={student.id} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="subsidies" activeTab={activeTab} className="mt-6">
        <SubsidiesTab studentId={student.id} />
      </SegmentedTabPanelContent>

      <SegmentedTabPanelContent when="billing-preferences" activeTab={activeTab} className="mt-6">
        <BillingPreferencesTab student={student} />
      </SegmentedTabPanelContent>
    </SegmentedTabPanel>
  );
}



