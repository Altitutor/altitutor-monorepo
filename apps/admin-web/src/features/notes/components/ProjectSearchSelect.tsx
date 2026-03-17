'use client';

import { useMemo, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@altitutor/ui';
import { Check, ChevronDown, FolderKanban } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useProjects } from '@/features/projects/api/queries';
import type { NoteFormData } from '../types';

function getMatchScore(name: string | null, rawQuery: string): number {
  const query = rawQuery.trim().toLowerCase();
  const text = (name || '').toLowerCase();

  if (!query) return 0;
  if (!text) return -1;

  if (text === query) return 300;
  if (text.startsWith(query)) return 200 - Math.max(0, text.length - query.length);

  const index = text.indexOf(query);
  if (index === -1) return -1;
  return 100 - index;
}

interface ProjectSearchSelectProps {
  form: UseFormReturn<NoteFormData>;
  variant?: 'default' | 'pill';
}

export function ProjectSearchSelect({ form, variant = 'default' }: ProjectSearchSelectProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: projects = [] } = useProjects();

  const projectMatches = useMemo(() => {
    const scored = projects
      .map((item) => ({ item, score: getMatchScore(item.name, searchQuery) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => item);
  }, [projects, searchQuery]);

  const selectedProject = projects.find((p) => p.id === form.watch('project_id'));

  return (
    <FormField
      control={form.control}
      name="project_id"
      render={({ field }) => (
        <FormItem>
          <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
              <FormControl>
                <Button
                  variant="outline"
                  className={cn(
                    'justify-start',
                    variant === 'default' && 'w-full',
                    variant === 'pill' && 'h-8 px-3 text-xs border rounded-full w-auto min-w-[120px]'
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    setIsPopoverOpen(true);
                  }}
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
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <Input
                  type="text"
                  placeholder="Search projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-1 pr-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        field.onChange(null);
                        setIsPopoverOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {!field.value && <Check className="h-4 w-4" />}
                        <span className={!field.value ? 'font-medium' : ''}>No project</span>
                      </div>
                    </Button>
                    {projectMatches.map((project) => (
                      <Button
                        key={project.id}
                        variant="ghost"
                        className="w-full justify-start h-auto p-3"
                        onClick={() => {
                          field.onChange(project.id);
                          setIsPopoverOpen(false);
                          setSearchQuery('');
                        }}
                      >
                        <div className="flex items-center gap-2 w-full min-w-0">
                          {field.value === project.id && <Check className="h-4 w-4 flex-shrink-0" />}
                          <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span
                            className={cn(
                              'truncate',
                              field.value === project.id && 'font-medium'
                            )}
                          >
                            {project.name || 'Untitled project'}
                          </span>
                        </div>
                      </Button>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </PopoverContent>
          </Popover>
        </FormItem>
      )}
    />
  );
}
