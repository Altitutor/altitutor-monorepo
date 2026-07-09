import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { tasksApi } from './tasks';
import { tasksKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { Task, TaskInsert, TaskUpdate, TaskWithAssignee } from '../types';
import { showWorkItemCreatedToast } from '@/shared/utils';

type TaskUpdateVariables = { id: string; updates: TaskUpdate };

type TaskUpdateSnapshot = {
  previousLists: Array<[QueryKey, TaskWithAssignee[] | undefined]>;
  previousDetail: TaskWithAssignee | undefined;
};

function applyTaskOptimisticUpdate(task: TaskWithAssignee, updates: TaskUpdate): TaskWithAssignee {
  const next: TaskWithAssignee = { ...task, ...updates };

  if ('assigned_to' in updates && updates.assigned_to !== task.assignee?.id) {
    next.assignee = null;
  }
  if ('issue_id' in updates && updates.issue_id !== task.issue?.id) {
    next.issue = null;
  }
  if ('project_id' in updates && updates.project_id !== task.project?.id) {
    next.project = null;
  }

  return next;
}

/**
 * Create a new task. Caller must pass created_by (e.g. from useCurrentStaff()).
 */
export function useCreateTask() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (task: TaskInsert) => tasksApi.create(task),
    onSuccess: (createdTask) => {
      // Invalidate tasks list
      queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
      if (createdTask?.id) {
        showWorkItemCreatedToast({
          toast,
          entityType: 'task',
          entityId: createdTask.id,
        });
      } else {
        toast({
          title: 'Task created',
          description: 'The task has been created successfully.',
        });
      }
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

  return useMutation<Task, Error, TaskUpdateVariables, TaskUpdateSnapshot>({
    mutationFn: async ({ id, updates }: TaskUpdateVariables) =>
      tasksApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: tasksKeys.lists() }),
        queryClient.cancelQueries({ queryKey: tasksKeys.detail(id) }),
      ]);

      const previousLists = queryClient.getQueriesData<TaskWithAssignee[]>({
        queryKey: tasksKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData<TaskWithAssignee>(tasksKeys.detail(id));

      queryClient.setQueriesData<TaskWithAssignee[]>({ queryKey: tasksKeys.lists() }, (current) =>
        current?.map((task) => (task.id === id ? applyTaskOptimisticUpdate(task, updates) : task))
      );
      queryClient.setQueryData<TaskWithAssignee>(tasksKeys.detail(id), (current) =>
        current ? applyTaskOptimisticUpdate(current, updates) : current
      );

      return { previousLists, previousDetail };
    },
    onError: (error: Error, { id }, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      queryClient.setQueryData(tasksKeys.detail(id), context?.previousDetail);

      toast({
        title: 'Error',
        description: error.message || 'Failed to update task',
        variant: 'destructive',
      });
    },
    onSettled: (_updatedTask, _error, { id }) => {
      void queryClient.invalidateQueries({ queryKey: tasksKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: tasksKeys.detail(id) });
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
