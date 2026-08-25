import { useQuery } from '@tanstack/react-query';
import { projectsApi } from './projects';
import { projectKeys } from './queryKeys';
import type { ProjectFilters } from '../types';
import { tasksKeys } from '@/features/tasks/api/queryKeys';
import { useSupabaseRealtimeInvalidation } from '@/shared/hooks/useSupabaseRealtimeInvalidation';

const getProjectDetailKey = (id: string) => projectKeys.detail(id);
const PROJECTS_REALTIME_DEBOUNCE_MS = 500;

export function useProjects(filters?: ProjectFilters) {
  useSupabaseRealtimeInvalidation({
    table: 'projects',
    queryKey: projectKeys.all,
    detailKey: getProjectDetailKey,
    extraQueryKeys: [tasksKeys.all],
    debounceMs: PROJECTS_REALTIME_DEBOUNCE_MS,
  });
  useSupabaseRealtimeInvalidation({
    table: 'project_members',
    queryKey: projectKeys.all,
    extraQueryKeys: [tasksKeys.all],
    getRelatedKeys: (row) => (row.project_id ? [projectKeys.detail(row.project_id)] : []),
    debounceMs: PROJECTS_REALTIME_DEBOUNCE_MS,
  });

  return useQuery({
    queryKey: projectKeys.list(JSON.stringify(filters || {})),
    queryFn: () => projectsApi.list(filters),
  });
}

export function useProject(projectId: string, enabled = true) {
  useSupabaseRealtimeInvalidation({
    table: 'projects',
    queryKey: projectKeys.all,
    detailKey: getProjectDetailKey,
    extraQueryKeys: [tasksKeys.all],
    debounceMs: PROJECTS_REALTIME_DEBOUNCE_MS,
    enabled: enabled && !!projectId,
  });
  useSupabaseRealtimeInvalidation({
    table: 'project_members',
    queryKey: projectKeys.all,
    extraQueryKeys: [tasksKeys.all],
    getRelatedKeys: (row) => (row.project_id ? [projectKeys.detail(row.project_id)] : []),
    debounceMs: PROJECTS_REALTIME_DEBOUNCE_MS,
    enabled: enabled && !!projectId,
  });

  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId && enabled,
  });
}
