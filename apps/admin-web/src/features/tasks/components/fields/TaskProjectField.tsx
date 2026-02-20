'use client';

import { useMemo, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from '@altitutor/ui';
import { Button, Input, Popover, PopoverContent, PopoverTrigger, ScrollArea } from '@altitutor/ui';
import { Check, FolderKanban } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
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
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [projectSearchQuery, setProjectSearchQuery] = useState('');
  const { data: projects = [] } = useProjects();

  const filteredProjects = useMemo(() => {
    const query = projectSearchQuery.trim().toLowerCase();
    if (!query) return projects;
    return projects.filter((project) => (project.name || '').toLowerCase().includes(query));
  }, [projects, projectSearchQuery]);

  return (
    <FormField
      control={form.control}
      name="projectId"
      render={() => (
        <FormItem>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPopoverOpen(true);
                  }}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="truncate text-left">
                      {selectedProject?.name || 'Link project'}
                    </span>
                  </div>
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={projectSearchQuery}
                  onChange={(e) => setProjectSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        onProjectChange(null);
                        setIsPopoverOpen(false);
                        setProjectSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {!selectedProject && <Check className="h-4 w-4" />}
                        <span className={!selectedProject ? 'font-medium' : ''}>No project</span>
                      </div>
                    </Button>
                    {filteredProjects.length === 0 ? (
                      <div className="p-3 text-center text-sm text-muted-foreground">
                        {projectSearchQuery ? 'No projects match your search' : 'No projects found'}
                      </div>
                    ) : (
                      filteredProjects.map((project) => (
                        <Button
                          key={project.id}
                          variant="ghost"
                          className="w-full justify-start h-auto p-3"
                          onClick={() => {
                            onProjectChange({ id: project.id, name: project.name });
                            setIsPopoverOpen(false);
                            setProjectSearchQuery('');
                            // Enforce exclusivity in UI
                            form.setValue('issueId', null, { shouldDirty: true });
                          }}
                        >
                          <div className="flex items-center gap-2 w-full min-w-0">
                            {selectedProject?.id === project.id && (
                              <Check className="h-4 w-4 flex-shrink-0" />
                            )}
                            <span className={selectedProject?.id === project.id ? 'font-medium truncate' : 'truncate'}>
                              {project.name || 'Untitled project'}
                            </span>
                          </div>
                        </Button>
                      ))
                    )}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
