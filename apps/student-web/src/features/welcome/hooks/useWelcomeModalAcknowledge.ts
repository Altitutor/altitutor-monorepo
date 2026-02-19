import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@altitutor/ui';
import { welcomeApi } from '../api/welcome';

export function useWelcomeModalAcknowledge() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: () => welcomeApi.acknowledgeWelcomeModal(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['student', 'profile'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save welcome modal status',
        variant: 'destructive',
      });
    },
  });
}
