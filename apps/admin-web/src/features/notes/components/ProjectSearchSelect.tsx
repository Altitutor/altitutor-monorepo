'use client';

import { FormControl, FormField, FormItem, SearchableSelect } from '@altitutor/ui';
import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useProjects } from '@/features/projects/api/queries';
import type { NoteFormData } from '../types';

type Project = { id: string; name: string | null };

interface ProjectSearchSelectProps {
  form: UseFormReturn<NoteFormData>;
  variant?: 'default' | 'pill';
}

export function ProjectSearchSelect({ form, variant = 'default' }: ProjectSearchSelectProps) {
  const { data: projects = [] } = useProjects();

  return (
    <FormField
      control={form.control}
      name="project_id"
      render={({ field }) => {
        const selectedProject = projects.find((p) => p.id === field.value) ?? null;

        const trigger = (
          <FormControl>
            <button
              type="button"
              className={cn(
                'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border hover:bg-muted h-10 px-4 py-2',
                'justify-start',
                variant === 'default' && 'w-full',
                variant === 'pill' && 'h-8 px-3 text-xs border rounded-full w-auto min-w-[120px]'
              )}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FolderKanban
                  className={cn('text-muted-foreground flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
                />
                <span className="text-muted-foreground shrink-0">Project</span>
                <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                  {selectedProject?.name || 'No project'}
                </span>
                <ChevronDown
                  className={cn('text-muted-foreground ml-auto flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
                />
              </div>
            </button>
          </FormControl>
        );

        return (
          <FormItem>
            <SearchableSelect<Project>
              items={projects}
              value={selectedProject}
              onValueChange={(p) => field.onChange(p?.id ?? null)}
              getItemId={(p) => p.id}
              getItemLabel={(p) => p.name || 'Untitled project'}
              placeholder="No project"
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
                  <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span className={cn('truncate', isSelected && 'font-medium')}>
                    {project.name || 'Untitled project'}
                  </span>
                </>
              )}
            />
          </FormItem>
        );
      }}
    />
  );
}
