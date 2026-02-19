import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import {
  getBillingPreferences,
  updateBillingPreferences,
  type BillingPreferences,
  type BillingPreferencesUpdate,
} from '../api/billing-preferences';
import { studentsKeys } from '@/features/students/hooks/useStudentsQuery';

export const billingPreferencesKeys = {
  all: ['billing-preferences'] as const,
  detail: (studentId: string) => [...billingPreferencesKeys.all, studentId] as const,
};

interface UseBillingPreferencesOptions {
  studentId: string | null;
  enabled?: boolean;
}

/**
 * React Query hook for student billing preferences.
 * Replaces useEffect-based fetching in BillingPreferencesSection.
 */
export function useBillingPreferences({
  studentId,
  enabled = true,
}: UseBillingPreferencesOptions) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const query = useQuery({
    queryKey: billingPreferencesKeys.detail(studentId ?? ''),
    queryFn: () => getBillingPreferences(studentId!),
    enabled: enabled && !!studentId,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

  const mutation = useMutation({
    mutationFn: ({
      studentId: id,
      update,
    }: {
      studentId: string;
      update: BillingPreferencesUpdate;
    }) => updateBillingPreferences(id, update),
    onMutate: async ({ studentId: id, update }) => {
      await queryClient.cancelQueries({ queryKey: billingPreferencesKeys.detail(id) });
      const previous = queryClient.getQueryData<BillingPreferences>(
        billingPreferencesKeys.detail(id)
      );
      if (previous) {
        queryClient.setQueryData<BillingPreferences>(billingPreferencesKeys.detail(id), {
          ...previous,
          ...update,
        });
      }
      return { previous };
    },
    onError: (error: Error, { studentId: id }, context) => {
      if (context?.previous) {
        queryClient.setQueryData(billingPreferencesKeys.detail(id), context.previous);
      }
      toast({
        title: 'Error',
        description: error.message || 'Failed to update billing preference',
        variant: 'destructive',
      });
    },
    onSuccess: (_, { studentId: id }) => {
      queryClient.invalidateQueries({ queryKey: billingPreferencesKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: studentsKeys.detail(id) });
      toast({ title: 'Success', description: 'Billing preference updated' });
    },
  });

  const updatePreference = (
    studentIdParam: string,
    field: keyof BillingPreferences,
    value: boolean
  ) => {
    return mutation.mutateAsync({
      studentId: studentIdParam,
      update: { [field]: value },
    });
  };

  return {
    preferences: query.data ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    updatePreference,
    isUpdating: mutation.isPending,
  };
}
