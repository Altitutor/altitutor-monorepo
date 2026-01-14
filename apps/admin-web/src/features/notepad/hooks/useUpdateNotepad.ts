import { useMutation, useQueryClient } from '@tanstack/react-query';
import { notepadApi } from '../api/notepad';
import { useToast } from '@altitutor/ui';

export function useUpdateNotepad() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (content: string) => notepadApi.updateNotepad(content),
    onSuccess: () => {
      // Invalidate notepad query to refetch
      queryClient.invalidateQueries({ queryKey: ['admin', 'notepad'] });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save notepad',
        variant: 'destructive',
      });
    },
  });
}
