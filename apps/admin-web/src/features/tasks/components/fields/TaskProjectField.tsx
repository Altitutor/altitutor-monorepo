'use client';

import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Check, FolderKanban } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useProjects } from '@/features/projects/api/queries';
import type { TaskFormData } from '../../types';

type ProjectOption = {
  id: string;
  name: string | null;
};

interface TaskProjectFieldProps {
  form: UseFormReturn<TaskFormData>;
  selectedProject: ProjectOption | null;
  onProjectChange: (project: ProjectOption | null) => void;
}

export function TaskProjectField({
  form,
  selectedProject,
  onProjectChange,
}: TaskProjectFieldProps) {
  const { data: projects = [] } = useProjects();

  const trigger = (
    <FormControl>
      <button
        type="button"
        className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border hover:bg-muted h-10 px-4 py-2 w-full justify-start"
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <span className={cn('truncate text-left', !selectedProject && 'text-muted-foreground')}>
            {selectedProject?.name || 'Link project'}
          </span>
        </div>
      </button>
    </FormControl>
  );

  return (
    <FormField
      control={form.control}
      name="projectId"
      render={() => (
        <FormItem>
          <SearchableSelect<ProjectOption>
            items={projects}
            value={selectedProject}
            onValueChange={(project) => {
              onProjectChange(project);
              if (project) {
                form.setValue('issueId', null, { shouldDirty: true });
              }
            }}
            getItemId={(p) => p.id}
            getItemLabel={(p) => p.name || 'Untitled project'}
            placeholder="Link project"
            searchPlaceholder="Search projects..."
            emptyMessage="No projects found"
            trigger={trigger}
            allowClear
            contentWidth="400px"
            renderItem={(project, isSelected) => (
              <>
                <Check
                  className={
                    isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                  }
                />
                <span className={cn('truncate', isSelected && 'font-medium')}>
                  {project.name || 'Untitled project'}
                </span>
              </>
            )}
          />
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
