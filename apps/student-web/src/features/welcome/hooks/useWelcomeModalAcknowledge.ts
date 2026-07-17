import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { ONBOARDING_QUERY_KEY } from '@/features/onboarding/hooks/use-onboarding-progress';
import { welcomeApi } from '../api/welcome';

export function useWelcomeModalAcknowledge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => welcomeApi.acknowledgeWelcomeModal(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
      queryClient.invalidateQueries({ queryKey: ONBOARDING_QUERY_KEY });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save welcome guide status',
        variant: 'destructive',
      });
    },
  });
}
