import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksApi } from './tasks';
import { tasksKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { TaskInsert, TaskUpdate } from '../types';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';

/**
 * Create a new task
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { data: currentStaff } = useCurrentStaff();

  return useMutation({
    mutationFn: async (task: Omit<TaskInsert, 'created_by'>) => {
      // Set created_by from current staff
      const taskWithCreator: TaskInsert = {
        ...task,
        created_by: currentStaff?.id ?? null,
      };
      return tasksApi.create(taskWithCreator);
    },
    onSuccess: () => {
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
      toast({
        title: 'Task created',
        description: 'The task has been created successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create task',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Update a task
 */
export function useUpdateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdate }) =>
      tasksApi.update(id, updates),
    onSuccess: (updatedTask, { id }) => {
      // Update specific task in cache
      queryClient.setQueryData(tasksKeys.detail(id), updatedTask);
      
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
      
      toast({
        title: 'Task updated',
        description: 'The task has been updated successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    },
  });
}

/**
 * Delete a task
 */
export function useDeleteTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (taskId: string) => tasksApi.delete(taskId),
    onSuccess: (_, deletedId) => {
      // Remove from detail cache
      queryClient.removeQueries({ queryKey: tasksKeys.detail(deletedId) });
      
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
      
      toast({
        title: 'Task deleted',
        description: 'The task has been deleted successfully.',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete task',
        variant: 'destructive',
      });
    },
  });
}

