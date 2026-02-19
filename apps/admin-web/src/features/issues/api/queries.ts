import { useQuery } from '@tanstack/react-query';
import { issuesApi } from './issues';
import { issueKeys } from './queryKeys';
import type { IssueFilters } from '../types';

export function useIssues(filters?: IssueFilters) {
  return useQuery({
    queryKey: issueKeys.list(JSON.stringify(filters || {})),
    queryFn: () => issuesApi.list(filters),
  });
}

export function useIssue(issueId: string, enabled = true) {
  return useQuery({
    queryKey: issueKeys.detail(issueId),
    queryFn: () => issuesApi.get(issueId),
    enabled: !!issueId && enabled,
  });
}
