import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from './projects';
import { projectKeys } from './queryKeys';
import { useToast } from '@altitutor/ui';
import type { ProjectInsert, ProjectUpdate } from '../types';

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (project: ProjectInsert) => projectsApi.create(project),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      toast({ title: 'Project created', description: 'The project has been successfully created.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error creating project',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: ProjectUpdate }) => projectsApi.update(id, updates),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error updating project',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (id: string) => projectsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['notes'] });
      toast({ title: 'Project deleted', description: 'The project has been successfully deleted.' });
    },
    onError: (error: unknown) => {
      toast({
        title: 'Error deleting project',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
  });
}
