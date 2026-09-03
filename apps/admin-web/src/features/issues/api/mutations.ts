import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { issuesApi } from './issues';
import { issueKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { Issue, IssueUpdate, IssueWithTags } from '../types';
import { showWorkItemCreatedToast } from '@/shared/utils';
import { activityKeys } from '@/features/activity/queryKeys';

type IssueUpdateVariables = { id: string; updates: IssueUpdate };

type IssueUpdateSnapshot = {
  previousLists: Array<[QueryKey, IssueWithTags[] | undefined]>;
  previousDetail: IssueWithTags | undefined;
};

function applyIssueOptimisticUpdate(issue: IssueWithTags, updates: IssueUpdate): IssueWithTags {
  return { ...issue, ...updates };
}

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

  return useMutation<Issue, Error, IssueUpdateVariables, IssueUpdateSnapshot>({
    mutationFn: ({ id, updates }: IssueUpdateVariables) => issuesApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: issueKeys.lists() }),
        queryClient.cancelQueries({ queryKey: issueKeys.detail(id) }),
      ]);

      const previousLists = queryClient.getQueriesData<IssueWithTags[]>({
        queryKey: issueKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData<IssueWithTags>(issueKeys.detail(id));

      queryClient.setQueriesData<IssueWithTags[]>({ queryKey: issueKeys.lists() }, (current) =>
        current?.map((issue) => (issue.id === id ? applyIssueOptimisticUpdate(issue, updates) : issue))
      );
      queryClient.setQueryData<IssueWithTags>(issueKeys.detail(id), (current) =>
        current ? applyIssueOptimisticUpdate(current, updates) : current
      );

      return { previousLists, previousDetail };
    },
    onError: (error: Error, { id }, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      queryClient.setQueryData(issueKeys.detail(id), context?.previousDetail);

      toast({ 
        title: 'Error updating issue', 
        description: error.message || 'An unexpected error occurred.',
        variant: 'destructive' 
      });
    },
    onSettled: (_updatedIssue, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: issueKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: issueKeys.detail(id) });
      void queryClient.invalidateQueries({ queryKey: activityKeys.issue(id) });
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
