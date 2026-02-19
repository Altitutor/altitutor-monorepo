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

export function useOpenIssuesByEntity(
  entityType: 'student' | 'staff' | 'parent' | 'class' | 'session' | 'invoice',
  entityId: string | null,
  enabled = true
) {
  return useQuery({
    queryKey: [...issueKeys.all, 'byEntity', entityType, entityId],
    queryFn: () => {
      if (!entityId) return [];
      return issuesApi.getOpenIssuesByEntity(entityType, entityId);
    },
    enabled: !!entityId && enabled,
  });
}
