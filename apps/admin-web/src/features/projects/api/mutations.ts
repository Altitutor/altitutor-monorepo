import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { projectsApi } from './projects';
import { useToast } from '@altitutor/ui';
import type { Project, ProjectCreateInput, ProjectUpdateInput, ProjectWithLead } from '../types';
import { showWorkItemCreatedToast } from '@/shared/utils';
import {
  invalidateProjectDetailSurfaces,
  invalidateProjectListSurfaces,
  invalidateProjectRemovalSurfaces,
} from '@/shared/lib/query-invalidation';
import { projectKeys } from './queryKeys';

type ProjectUpdateVariables = { id: string; updates: ProjectUpdateInput };

type ProjectUpdateSnapshot = {
  previousLists: Array<[QueryKey, ProjectWithLead[] | undefined]>;
  previousDetail: ProjectWithLead | undefined;
};

function applyProjectOptimisticUpdate(
  project: ProjectWithLead,
  updates: ProjectUpdateInput
): ProjectWithLead {
  const { member_ids, ...row } = updates;
  const next: ProjectWithLead = { ...project, ...row, members: [...(project.members ?? [])] };

  if ('project_lead_id' in row && row.project_lead_id !== project.project_lead?.id) {
    next.project_lead = null;
    const nextLeadId = row.project_lead_id ?? null;
    if (nextLeadId && !next.members.some((member) => member.id === nextLeadId)) {
      next.members = [...next.members, { id: nextLeadId, first_name: null, last_name: null }];
    }
  }

  if (member_ids !== undefined) {
    const leadId = next.project_lead_id ?? null;
    const byId = new Map(next.members.map((member) => [member.id, member]));
    next.members = [...new Set(leadId ? [...member_ids, leadId] : member_ids)].map(
      (id) => byId.get(id) ?? { id, first_name: null, last_name: null }
    );
  }

  return next;
}

export function useCreateProject() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ memberIds, ...project }: ProjectCreateInput) =>
      projectsApi.create(project, memberIds),
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

  return useMutation<Project, unknown, ProjectUpdateVariables, ProjectUpdateSnapshot>({
    mutationFn: ({ id, updates }: ProjectUpdateVariables) => projectsApi.update(id, updates),
    onMutate: async ({ id, updates }) => {
      await Promise.all([
        queryClient.cancelQueries({ queryKey: projectKeys.lists() }),
        queryClient.cancelQueries({ queryKey: projectKeys.detail(id) }),
      ]);

      const previousLists = queryClient.getQueriesData<ProjectWithLead[]>({
        queryKey: projectKeys.lists(),
      });
      const previousDetail = queryClient.getQueryData<ProjectWithLead>(projectKeys.detail(id));

      queryClient.setQueriesData<ProjectWithLead[]>({ queryKey: projectKeys.lists() }, (current) =>
        current?.map((project) =>
          project.id === id ? applyProjectOptimisticUpdate(project, updates) : project
        )
      );
      queryClient.setQueryData<ProjectWithLead>(projectKeys.detail(id), (current) =>
        current ? applyProjectOptimisticUpdate(current, updates) : current
      );

      return { previousLists, previousDetail };
    },
    onError: (error: unknown, { id }, context) => {
      context?.previousLists.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data);
      });
      queryClient.setQueryData(projectKeys.detail(id), context?.previousDetail);

      toast({
        title: 'Error updating project',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      });
    },
    onSettled: (_updatedProject, _error, { id }) => {
      void invalidateProjectDetailSurfaces(queryClient, id);
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
