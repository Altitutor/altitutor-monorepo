import { useQuery } from '@tanstack/react-query';
import { tasksApi } from './tasks';
import { tasksKeys } from './queryKeys';
import type { TaskFilters } from '../types';

/**
 * Get all tasks with optional filters
 */
export function useTasks(filters?: TaskFilters) {
  return useQuery({
    queryKey: tasksKeys.list(filters),
    queryFn: () => tasksApi.list(filters),
    staleTime: 1000 * 60 * 2, // 2 minutes - tasks change frequently
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

/**
 * Get a single task by ID
 */
export function useTask(taskId: string, enabled = true) {
  return useQuery({
    queryKey: tasksKeys.detail(taskId),
    queryFn: () => tasksApi.get(taskId),
    enabled: enabled && !!taskId,
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  });
}

