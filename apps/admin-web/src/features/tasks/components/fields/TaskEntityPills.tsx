'use client';

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SearchableSelect,
} from '@altitutor/ui';
import { User, Gauge, ChevronDown, Link2, FolderKanban } from 'lucide-react';
import { cn } from '@/shared/utils';
import {
  getPriorityIcon,
  getPriorityLabel,
  getPriorityIconColor,
  getEstimateLabel,
  getUserInitials,
  ESTIMATE_OPTIONS,
  PRIORITY_OPTIONS,
} from '../../utils/taskUtils';
import type { TaskWithAssignee, TaskPriority } from '../../types';

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

type AssigneeLike = { id: string; first_name: string | null; last_name: string | null };

type StaffLike = { id: string; first_name: string | null; last_name: string | null };

export function TaskAssigneeEntityPill({
  task,
  staffList,
  onChange,
  collapsed,
}: {
  task: TaskWithAssignee;
  staffList: StaffLike[];
  onChange: (staffId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const assignee: AssigneeLike | null = (() => {
    const a = task.assignee;
    if (a && typeof a === 'object' && 'first_name' in a) return a as AssigneeLike;
    const id = (typeof a === 'string' ? a : (task as { assigned_to?: string | null }).assigned_to) ?? null;
    if (!id) return null;
    const staff = staffList.find((s) => s.id === id);
    return staff ? { id: staff.id, first_name: staff.first_name, last_name: staff.last_name } : null;
  })();
  const initials = assignee ? getUserInitials(assignee.first_name, assignee.last_name) : null;

  return (
    <SearchableSelect<StaffLike>
      items={staffList}
      value={assignee}
      onValueChange={(s) => onChange(s?.id ?? null)}
      getItemId={(s) => s.id}
      getItemLabel={(s) => `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'}
      placeholder="Assign"
      searchPlaceholder="Search staff..."
      emptyMessage="No staff found"
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 border rounded-full group transition-colors bg-background',
            collapsed ? 'px-2 w-auto' : 'px-3 text-xs'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {assignee ? (
            <>
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium flex-shrink-0">
                {initials}
              </div>
              {!collapsed && (
                <span className="truncate max-w-[80px]">
                  {assignee.first_name} {assignee.last_name}
                </span>
              )}
            </>
          ) : (
            <>
              <User className={cn("h-3 w-3 text-muted-foreground", !assignee && "opacity-40 group-hover:opacity-100")} />
              {!collapsed && (
                <span className="text-muted-foreground opacity-40 group-hover:opacity-100">Assign</span>
              )}
            </>
          )}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground opacity-40 group-hover:opacity-100", !assignee && "opacity-40")} />
        </button>
      }
      allowClear
      clearLabel="Unassigned"
      contentWidth="280px"
      align="start"
      open={open}
      onOpenChange={setOpen}
      renderItem={(s, isSelected) => (
        <>
          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
            {getUserInitials(s.first_name, s.last_name)}
          </div>
          <span className={cn("truncate", isSelected && "font-medium")}>
            {`${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || 'Unnamed'}
          </span>
        </>
      )}
    />
  );
}

export function TaskPriorityEntityPill({
  value,
  onChange,
  collapsed,
}: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
  collapsed?: boolean;
}) {
  const label = getPriorityLabel(value);
  const iconColor = getPriorityIconColor(value);
  const Icon = getPriorityIcon(value);
  const isEmpty = value === 0;

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v) as TaskPriority)}
    >
      <SelectTrigger
        className={cn(
          "h-8 border rounded-full bg-background group gap-1.5",
          collapsed ? "px-2 w-auto" : "px-3 text-xs w-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={cn('h-3 w-3 flex-shrink-0', iconColor, isEmpty && "opacity-40 group-hover:opacity-100")} />
        {!collapsed && (
          <span className={cn("truncate", isEmpty && "text-muted-foreground opacity-40 group-hover:opacity-100")}>{label}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((o) => {
          const OptionIcon = getPriorityIcon(o.value);
          const optionColor = getPriorityIconColor(o.value);
          return (
            <SelectItem key={o.value} value={String(o.value)}>
              <div className="flex items-center gap-2">
                <OptionIcon className={cn('h-4 w-4', optionColor)} />
                <span>{o.label}</span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}

export function TaskEstimateEntityPill({
  value,
  onChange,
  collapsed,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  collapsed?: boolean;
}) {
  const label = value ? getEstimateLabel(value) : null;
  const isEmpty = value == null;

  return (
    <Select
      value={value ? String(value) : 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
    >
      <SelectTrigger
        className={cn(
          "h-8 border rounded-full bg-background group gap-1.5",
          collapsed ? "px-2 w-auto" : "px-3 text-xs w-auto"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <Gauge className={cn("h-3 w-3 text-muted-foreground flex-shrink-0", isEmpty && "opacity-40 group-hover:opacity-100")} />
        {!collapsed && (
          <span className={cn("truncate", isEmpty && "text-muted-foreground opacity-40 group-hover:opacity-100")}>{label || 'Estimate'}</span>
        )}
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {ESTIMATE_OPTIONS.map((o: { value: number; label: string }) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

type IssueLike = { id: string; name: string | null };

export function TaskIssueEntityPill({
  issue,
  issues,
  onChange,
  collapsed,
}: {
  issue?: IssueLike | null;
  issues: IssueLike[];
  onChange: (issueId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SearchableSelect<IssueLike>
      items={issues}
      value={issue ?? null}
      onValueChange={(i) => onChange(i?.id ?? null)}
      getItemId={(i) => i.id}
      getItemLabel={(i) => i.name || 'Untitled issue'}
      placeholder="Issue"
      searchPlaceholder="Search issues..."
      emptyMessage="No issues found"
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 border rounded-full group transition-colors bg-background',
            collapsed ? 'px-2 w-auto' : 'px-3 text-xs'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <Link2 className={cn("h-3 w-3 text-muted-foreground flex-shrink-0", !issue && "opacity-40 group-hover:opacity-100")} />
          {!collapsed && (
            <span className={cn("truncate max-w-[120px]", !issue && "text-muted-foreground opacity-40 group-hover:opacity-100")}>
              {issue?.name || 'Issue'}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 text-muted-foreground", !issue && "opacity-40 group-hover:opacity-100")} />
        </button>
      }
      allowClear
      clearLabel="No issue"
      contentWidth="320px"
      align="start"
      open={open}
      onOpenChange={setOpen}
    />
  );
}

type ProjectLike = { id: string; name: string | null };

export function TaskProjectEntityPill({
  project,
  projects,
  onChange,
  collapsed,
}: {
  project?: ProjectLike | null;
  projects: ProjectLike[];
  onChange: (projectId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <SearchableSelect<ProjectLike>
      items={projects}
      value={project ?? null}
      onValueChange={(p) => onChange(p?.id ?? null)}
      getItemId={(p) => p.id}
      getItemLabel={(p) => p.name || 'Untitled project'}
      placeholder="Project"
      searchPlaceholder="Search projects..."
      emptyMessage="No projects found"
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 border rounded-full group transition-colors bg-background',
            collapsed ? 'px-2 w-auto' : 'px-3 text-xs'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <FolderKanban className={cn('h-3 w-3 text-muted-foreground flex-shrink-0', !project && 'opacity-40 group-hover:opacity-100')} />
          {!collapsed && (
            <span className={cn('truncate max-w-[120px]', !project && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
              {project?.name || 'Project'}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground', !project && 'opacity-40 group-hover:opacity-100')} />
        </button>
      }
      allowClear
      clearLabel="No project"
      contentWidth="320px"
      align="start"
      open={open}
      onOpenChange={setOpen}
    />
  );
}

export function TaskLinkEntityPill({
  issue,
  project,
  issues,
  projects,
  onChange,
  collapsed,
}: {
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
  issues: { id: string; name: string | null }[];
  projects: { id: string; name: string | null }[];
  onChange: (link: LinkSelection) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const activeLink: LinkSelection = project
    ? { type: 'project', id: project.id, name: project.name }
    : issue
      ? { type: 'issue', id: issue.id, name: issue.name }
      : null;

  const issueMatches = useMemo(() => {
    const scored = issues
      .map((item) => ({ item, score: getMatchScore(item.name, search) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => ({ type: 'issue' as const, id: item.id, name: item.name }));
  }, [issues, search]);

  const projectMatches = useMemo(() => {
    const scored = projects
      .map((item) => ({ item, score: getMatchScore(item.name, search) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => ({ type: 'project' as const, id: item.id, name: item.name }));
  }, [projects, search]);

  const issueTopScore = issueMatches.length > 0 ? getMatchScore(issueMatches[0].name, search) : -1;
  const projectTopScore = projectMatches.length > 0 ? getMatchScore(projectMatches[0].name, search) : -1;
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
    <SearchableSelect<LinkItem>
      items={[]}
      groups={groups}
      value={activeLink}
      onValueChange={onChange}
      getItemId={(item) => `${item.type}-${item.id}`}
      getItemLabel={(item) => item.name || `Untitled ${item.type}`}
      placeholder="Link"
      searchPlaceholder="Search issues and projects..."
      emptyMessage="No results found"
      trigger={
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 border rounded-full group transition-colors bg-background',
            collapsed ? 'px-2 w-auto' : 'px-3 text-xs'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {activeLink?.type === 'project' ? (
            <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <Link2 className={cn('h-3 w-3 text-muted-foreground flex-shrink-0', !activeLink && 'opacity-40 group-hover:opacity-100')} />
          )}
          {!collapsed && (
            <span className={cn('truncate max-w-[150px]', !activeLink && 'text-muted-foreground opacity-40 group-hover:opacity-100')}>
              {activeLink?.name || 'Link'}
            </span>
          )}
          <ChevronDown className={cn('h-3 w-3 text-muted-foreground', !activeLink && 'opacity-40 group-hover:opacity-100')} />
        </button>
      }
      allowClear
      clearLabel="No link"
      contentWidth="360px"
      align="start"
      onSearchChange={setSearch}
      open={open}
      onOpenChange={setOpen}
      renderItem={(item) => (
        <>
          {item.type === 'issue' ? (
            <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          ) : (
            <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
          )}
          <span className="truncate">{item.name || `Untitled ${item.type}`}</span>
        </>
      )}
    />
  );
}
