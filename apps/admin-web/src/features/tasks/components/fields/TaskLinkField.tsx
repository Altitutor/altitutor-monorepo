'use client';

import { useMemo, useState } from 'react';
import {
  FormControl,
  FormField,
  FormItem,
  FormMessage,
  Button,
  SearchableSelect,
} from '@altitutor/ui';
import { ArrowUpRight, Check, ChevronDown, FolderKanban, Link2 } from 'lucide-react';
import { UseFormReturn } from 'react-hook-form';
import { cn } from '@/shared/utils';
import { useIssues } from '@/features/issues/api/queries';
import { useProjects } from '@/features/projects/api/queries';
import type { TaskFormData } from '../../types';

type LinkSelection =
  | { type: 'issue'; id: string; name: string | null }
  | { type: 'project'; id: string; name: string | null }
  | null;

type LinkItem = Exclude<LinkSelection, null>;

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
  onOpenIssue?: (issueId: string) => void;
  onOpenProject?: (projectId: string) => void;
}

export function TaskLinkField({
  form,
  selectedIssue,
  selectedProject,
  onLinkChange,
  onOpenIssue,
  onOpenProject,
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
    return scored.map(({ item }) => ({ type: 'issue' as const, id: item.id, name: item.name }));
  }, [issues, searchQuery]);

  const projectMatches = useMemo(() => {
    const scored = projects
      .map((item) => ({ item, score: getMatchScore(item.name, searchQuery) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => ({ type: 'project' as const, id: item.id, name: item.name }));
  }, [projects, searchQuery]);

  const issueTopScore = issueMatches.length > 0 ? getMatchScore(issueMatches[0].name, searchQuery) : -1;
  const projectTopScore = projectMatches.length > 0 ? getMatchScore(projectMatches[0].name, searchQuery) : -1;
  const showProjectsFirst = projectTopScore > issueTopScore;

  const groups = useMemo(() => {
    const ordered = showProjectsFirst
      ? [
          { type: 'project' as const, label: 'Projects', items: projectMatches },
          { type: 'issue' as const, label: 'Issues', items: issueMatches },
        ]
      : [
          { type: 'issue' as const, label: 'Issues', items: issueMatches },
          { type: 'project' as const, label: 'Projects', items: projectMatches },
        ];
    return ordered.filter((g) => g.items.length > 0).map((g) => ({ label: g.label, items: g.items }));
  }, [issueMatches, projectMatches, showProjectsFirst]);

  return (
    <FormField
      control={form.control}
      name="issueId"
      render={() => (
        <FormItem>
          <FormControl>
            <SearchableSelect<LinkItem>
              items={[]}
              groups={groups}
              value={activeLink}
              onValueChange={onLinkChange}
              getItemId={(item) => `${item.type}-${item.id}`}
              getItemLabel={(item) => item.name || `Untitled ${item.type}`}
              placeholder="Issue or project"
              searchPlaceholder="Search issues and projects..."
              emptyMessage="No results found"
              trigger={
                <Button variant="outline" className="w-full justify-start">
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
              }
              allowClear
              clearLabel="No link"
              contentWidth="400px"
              align="start"
              onSearchChange={setSearchQuery}
              open={isPopoverOpen}
              onOpenChange={setIsPopoverOpen}
              renderItem={(item, isSelected) => (
                <>
                  <Check
                    className={
                      isSelected ? 'h-4 w-4 flex-shrink-0 opacity-100' : 'h-4 w-4 flex-shrink-0 opacity-0'
                    }
                  />
                  {item.type === 'issue' ? (
                    <Link2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  ) : (
                    <FolderKanban className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  )}
                  <span className={cn('truncate', isSelected && 'font-medium')}>
                    {item.name || `Untitled ${item.type}`}
                  </span>
                </>
              )}
            />
          </FormControl>
          {activeLink && (activeLink.type === 'issue' ? onOpenIssue : onOpenProject) && (
            <Button
              type="button"
              variant="link"
              className="mt-1.5 h-auto p-0 text-xs text-primary hover:underline"
              onClick={() => {
                if (activeLink.type === 'issue') {
                  onOpenIssue?.(activeLink.id);
                } else {
                  onOpenProject?.(activeLink.id);
                }
              }}
            >
              {activeLink.type === 'issue' ? 'Go to issue' : 'Go to project'}
              <ArrowUpRight className="ml-1 h-3 w-3" />
            </Button>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

