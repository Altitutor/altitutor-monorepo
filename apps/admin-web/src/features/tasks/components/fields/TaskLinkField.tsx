'use client';

import { useMemo, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Button,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  ScrollArea,
} from '@altitutor/ui';
import { Check, ChevronDown, FolderKanban, Link2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useIssues } from '@/features/issues/api/queries';
import { useProjects } from '@/features/projects/api/queries';
import type { TaskFormData } from '../../types';

type LinkType = 'issue' | 'project';

type LinkSelection =
  | { type: 'issue'; id: string; name: string | null }
  | { type: 'project'; id: string; name: string | null }
  | null;

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

interface TaskLinkFieldProps {
  form: UseFormReturn<TaskFormData>;
  selectedIssue: { id: string; name: string | null } | null;
  selectedProject: { id: string; name: string | null } | null;
  onLinkChange: (link: LinkSelection) => void;
}

export function TaskLinkField({
  form,
  selectedIssue,
  selectedProject,
  onLinkChange,
}: TaskLinkFieldProps) {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { data: issues = [] } = useIssues();
  const { data: projects = [] } = useProjects();

  const activeLink: LinkSelection = selectedProject
    ? { type: 'project', id: selectedProject.id, name: selectedProject.name }
    : selectedIssue
      ? { type: 'issue', id: selectedIssue.id, name: selectedIssue.name }
      : null;

  const issueMatches = useMemo(() => {
    const scored = issues
      .map((item) => ({ item, score: getMatchScore(item.name, searchQuery) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => item);
  }, [issues, searchQuery]);

  const projectMatches = useMemo(() => {
    const scored = projects
      .map((item) => ({ item, score: getMatchScore(item.name, searchQuery) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => item);
  }, [projects, searchQuery]);

  const issueTopScore = issueMatches.length > 0 ? getMatchScore(issueMatches[0].name, searchQuery) : -1;
  const projectTopScore = projectMatches.length > 0 ? getMatchScore(projectMatches[0].name, searchQuery) : -1;
  const showProjectsFirst = projectTopScore > issueTopScore;

  const orderedGroups: Array<{ type: LinkType; label: string }> = showProjectsFirst
    ? [
        { type: 'project', label: 'Projects' },
        { type: 'issue', label: 'Issues' },
      ]
    : [
        { type: 'issue', label: 'Issues' },
        { type: 'project', label: 'Projects' },
      ];

  return (
    <FormField
      control={form.control}
      name="issueId"
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
                    {activeLink?.type === 'project' ? (
                      <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    ) : (
                      <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    )}
                    <span className="text-muted-foreground shrink-0">Link</span>
                    <span className={cn('truncate text-left', !activeLink && 'text-muted-foreground')}>
                      {activeLink?.name || 'Issue or project'}
                    </span>
                    <ChevronDown className="h-4 w-4 text-muted-foreground ml-auto" />
                  </div>
                </Button>
              </FormControl>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px]" align="start">
              <div className="p-3">
                <Input
                  type="text"
                  placeholder="Search issues and projects..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="mb-3"
                />
                <ScrollArea className="h-[300px]">
                  <div className="space-y-2 pr-4">
                    <Button
                      variant="ghost"
                      className="w-full justify-start h-auto p-3"
                      onClick={() => {
                        onLinkChange(null);
                        setIsPopoverOpen(false);
                        setSearchQuery('');
                      }}
                    >
                      <div className="flex items-center gap-2 w-full">
                        {!activeLink && <Check className="h-4 w-4" />}
                        <span className={!activeLink ? 'font-medium' : ''}>No link</span>
                      </div>
                    </Button>

                    {orderedGroups.map((group) => {
                      const items = group.type === 'issue' ? issueMatches : projectMatches;
                      if (items.length === 0) return null;

                      return (
                        <div key={group.type} className="space-y-1">
                          <div className="px-3 pt-1 pb-0.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                            {group.label}
                          </div>
                          {items.map((item) => (
                            <Button
                              key={`${group.type}-${item.id}`}
                              variant="ghost"
                              className="w-full justify-start h-auto p-3"
                              onClick={() => {
                                onLinkChange({ type: group.type, id: item.id, name: item.name });
                                setIsPopoverOpen(false);
                                setSearchQuery('');
                              }}
                            >
                              <div className="flex items-center gap-2 w-full min-w-0">
                                {activeLink?.type === group.type && activeLink.id === item.id && (
                                  <Check className="h-4 w-4 flex-shrink-0" />
                                )}
                                {group.type === 'issue' ? (
                                  <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                                )}
                                <span className={cn('truncate', activeLink?.type === group.type && activeLink.id === item.id && 'font-medium')}>
                                  {item.name || `Untitled ${group.type}`}
                                </span>
                              </div>
                            </Button>
                          ))}
                        </div>
                      );
                    })}
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

