'use client';

import {
  Button,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  SearchableSelect,
} from '@altitutor/ui';
import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useProjects } from '@/features/projects/api/queries';
import type { NoteFormData } from '../types';

const NOTE_PROP_SELECT_POPOVER_WIDTH = '260px';

const PROPERTIES_GRID_CLASS = 'grid grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 space-y-0';

type Project = { id: string; name: string | null };

interface ProjectSearchSelectProps {
  form: UseFormReturn<NoteFormData>;
  variant?: 'default' | 'pill' | 'properties';
  editable?: boolean;
  onDisabledInteract?: () => void;
}

export function ProjectSearchSelect({
  form,
  variant = 'default',
  editable = true,
  onDisabledInteract,
}: ProjectSearchSelectProps) {
  const { data: projects = [] } = useProjects();
  const isProperties = variant === 'properties';

  return (
    <FormField
      control={form.control}
      name="project_id"
      render={({ field }) => {
        const selectedProject = projects.find((p) => p.id === field.value) ?? null;
        const displayLabel = selectedProject?.name || 'No project';

        const propertiesTrigger = (
          <Button
            type="button"
            variant="field"
            disabled={!editable}
            className="w-full justify-start"
            onPointerDown={(event) => {
              if (!editable) {
                event.preventDefault();
                onDisabledInteract?.();
              }
            }}
          >
            <div className="flex items-center gap-2 w-full min-w-0">
              <FolderKanban className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                {displayLabel}
              </span>
            </div>
          </Button>
        );

        const defaultTrigger = (
          <button
            type="button"
            disabled={!editable}
            onPointerDown={(event) => {
              if (!editable) {
                event.preventDefault();
                onDisabledInteract?.();
              }
            }}
            className={cn(
              'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 border hover:bg-muted h-10 px-4 py-2 justify-start',
              !editable && 'opacity-50',
              variant === 'default' && 'w-full max-w-[260px]',
              variant === 'pill' && 'h-8 px-3 text-xs border rounded-full w-auto min-w-[120px]'
            )}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FolderKanban
                className={cn('text-muted-foreground flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
              />
              <span className="text-muted-foreground shrink-0">Project</span>
              <span className={cn('truncate', !field.value && 'text-muted-foreground')}>
                {displayLabel}
              </span>
              <ChevronDown
                className={cn('text-muted-foreground ml-auto flex-shrink-0', variant === 'pill' && 'h-3 w-3')}
              />
            </div>
          </button>
        );

        const searchableSelect = (
          <SearchableSelect<Project>
            items={projects}
            disabled={!editable}
            fullWidth={isProperties}
            value={selectedProject}
            onValueChange={(p) => field.onChange(p?.id ?? null)}
            getItemId={(p) => p.id}
            getItemLabel={(p) => p.name || 'Untitled project'}
            placeholder="No project"
            searchPlaceholder="Search projects..."
            emptyMessage="No projects found"
            trigger={isProperties ? propertiesTrigger : defaultTrigger}
            allowClear
            contentWidth={NOTE_PROP_SELECT_POPOVER_WIDTH}
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
        );

        if (isProperties) {
          return (
            <FormItem className={PROPERTIES_GRID_CLASS}>
              <FormLabel className="text-muted-foreground">Project</FormLabel>
              <FormControl>{searchableSelect}</FormControl>
              <FormMessage className="col-start-2" />
            </FormItem>
          );
        }

        return (
          <FormItem>
            <FormControl>{searchableSelect}</FormControl>
          </FormItem>
        );
      }}
    />
  );
}
