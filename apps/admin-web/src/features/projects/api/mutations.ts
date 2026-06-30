import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectsApi } from './projects';
import { useToast } from '@altitutor/ui';
import type { ProjectInsert, ProjectUpdate } from '../types';
import { showWorkItemCreatedToast } from '@/shared/utils';
import {
  invalidateProjectDetailSurfaces,
  invalidateProjectListSurfaces,
  invalidateProjectRemovalSurfaces,
} from '@/shared/lib/query-invalidation';

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: (project: ProjectInsert) => projectsApi.create(project),
    onSuccess: (createdProject) => {
      void invalidateProjectListSurfaces(queryClient);
      if (createdProject?.id) {
        showWorkItemCreatedToast({
          toast,
          entityType: 'project',
          entityId: createdProject.id,
        });
      } else {
        toast({ title: 'Project created', description: 'The project has been successfully created.' });
      }
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
      void invalidateProjectDetailSurfaces(queryClient, id);
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
      void invalidateProjectRemovalSurfaces(queryClient);
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
