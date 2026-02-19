import { useMutation, useQueryClient } from '@tanstack/react-query';
import { issuesApi } from './issues';
import { issueKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { IssueInsert, IssueUpdate, IssueTagInsert } from '../types';

export function useCreateIssue() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (data: { issue: IssueInsert, tags?: Omit<IssueTagInsert, 'issue_id'>[] }) => issuesApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      toast({ title: 'Issue created', description: 'The issue has been successfully created.' });
    },
    onError: (error: any) => {
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
    onError: (error: any) => {
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
    onError: (error: any) => {
      toast({ 
        title: 'Error deleting issue', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive' 
      });
    },
  });
}

export function useAddIssueTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tag: IssueTagInsert) => issuesApi.addTag(tag),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(variables.issue_id) });
    },
  });
}

export function useRemoveIssueTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tagId, issueId }: { tagId: string, issueId: string }) => issuesApi.removeTag(tagId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: issueKeys.detail(variables.issueId) });
    },
  });
}
