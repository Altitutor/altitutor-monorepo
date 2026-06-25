import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from './issues';
import { issueKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { IssueUpdate } from '../types';
import { showWorkItemCreatedToast } from '@/shared/utils';

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: Parameters<typeof issuesApi.create>[0]) => issuesApi.create(data),
    onSuccess: (createdIssue) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      if (createdIssue?.id) {
        showWorkItemCreatedToast({
          toast,
          entityType: 'issue',
          entityId: createdIssue.id,
        });
      } else {
        toast({ title: 'Issue created', description: 'The issue has been successfully created.' });
      }
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error creating issue', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive' 
      });
    },
  });
}

export function useUpdateIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string, updates: IssueUpdate }) => issuesApi.update(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(id) });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error updating issue', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive' 
      });
    },
  });
}

export function useDeleteIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => issuesApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      toast({ title: 'Issue deleted', description: 'The issue has been successfully deleted.' });
    },
    onError: (error: Error) => {
      toast({ 
        title: 'Error deleting issue', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive' 
      });
    },
  });
}
