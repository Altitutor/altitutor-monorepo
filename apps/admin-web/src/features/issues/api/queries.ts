import { useQuery } from '@tanstack/react-query';
import { issuesApi } from './issues';
import { issueKeys } from './queryKeys';
import type { IssueFilters } from '../types';
import { tasksKeys } from '@/features/tasks/api/queryKeys';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';

const getIssueDetailKey = (id: string) => issueKeys.detail(id);
const getIssueTagRelatedKeys = (row: { issue_id?: string | null }) =>
  row.issue_id ? [issueKeys.detail(row.issue_id)] : [];

function useIssuesRealtimeInvalidation() {
  useSupabaseRealtimeInvalidation({
    table: 'issues',
    queryKey: issueKeys.all,
    detailKey: getIssueDetailKey,
    extraQueryKeys: [tasksKeys.all],
  });

  useSupabaseRealtimeInvalidation({
    table: 'issue_tags',
    queryKey: issueKeys.all,
    getRelatedKeys: getIssueTagRelatedKeys,
  });
}

export function useIssues(filters?: IssueFilters) {
  useIssuesRealtimeInvalidation();

  return useQuery({
    queryKey: issueKeys.list(JSON.stringify(filters || {})),
    queryFn: () => issuesApi.list(filters),
  });
}

export function useIssue(issueId: string, enabled = true) {
  useIssuesRealtimeInvalidation();

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
  useIssuesRealtimeInvalidation();

  return useQuery({
    queryKey: [...issueKeys.all, 'byEntity', entityType, entityId],
    queryFn: () => {
      if (!entityId) return [];
      return issuesApi.getOpenIssuesByEntity(entityType, entityId);
    },
    enabled: !!entityId && enabled,
  });
}
