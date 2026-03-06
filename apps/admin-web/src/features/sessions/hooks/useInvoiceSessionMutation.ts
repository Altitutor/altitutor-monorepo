import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { sessionsKeys } from './useSessionsQuery';
import { reconciliationKeys } from '@/features/reconciliation/api/queryKeys';

export function useInvoiceSessionMutation(_options?: {
  onOpenInvoice?: (invoiceId: string) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (sessions_students_id: string) => {
      const response = await fetch('/api/billing/single', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessions_students_id }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || 'Failed to invoice session');
      }

      return response.json() as Promise<{ invoiceId?: string } | null | undefined>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: sessionsKeys.all });
      queryClient.invalidateQueries({ queryKey: reconciliationKeys.uninvoicedSessions() });
      toast({
        title: 'Success',
        description: 'Session invoiced successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to invoice session',
        variant: 'destructive',
      });
    },
  });
}
