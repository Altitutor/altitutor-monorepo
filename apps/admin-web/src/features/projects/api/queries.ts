import { useQuery } from '@tanstack/react-query';
import { projectsApi } from './projects';
import { projectKeys } from './queryKeys';
import type { ProjectFilters } from '../types';

export function useProjects(filters?: ProjectFilters) {
  return useQuery({
    queryKey: projectKeys.list(JSON.stringify(filters || {})),
    queryFn: () => projectsApi.list(filters),
  });
}

export function useProject(projectId: string, enabled = true) {
  return useQuery({
    queryKey: projectKeys.detail(projectId),
    queryFn: () => projectsApi.get(projectId),
    enabled: !!projectId && enabled,
  });
}
