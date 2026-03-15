'use client';

import { useState, useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Input,
  ScrollArea,
} from '@altitutor/ui';
import { User, Check, Gauge, ChevronDown, Link2, FolderKanban } from 'lucide-react';
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

type AssigneeLike = { id: string; first_name: string | null; last_name: string | null };

export function TaskAssigneeEntityPill({
  task,
  staffList,
  onChange,
  collapsed,
}: {
  task: TaskWithAssignee;
  staffList: { id: string; first_name: string | null; last_name: string | null }[];
  onChange: (staffId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  // Resolve assignee: task.assignee can be object (existing task) or id string (add-row draft)
  const assignee: AssigneeLike | null = (() => {
    const a = task.assignee;
    if (a && typeof a === 'object' && 'first_name' in a) return a as AssigneeLike;
    const id = (typeof a === 'string' ? a : (task as { assigned_to?: string | null }).assigned_to) ?? null;
    if (!id) return null;
    const staff = staffList.find((s) => s.id === id);
    return staff ? { id: staff.id, first_name: staff.first_name, last_name: staff.last_name } : null;
  })();
  const assigneeId = assignee?.id ?? null;
  const initials = assignee ? getUserInitials(assignee.first_name, assignee.last_name) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-2">
          <Input
            placeholder="Search staff..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <ScrollArea className="h-[200px]">
            <div className="space-y-0.5 pr-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {!assigneeId && <Check className="h-4 w-4" />}
                <span>Unassigned</span>
              </button>
              {staffList
                .filter(
                  (s) =>
                    !search.trim() ||
                    `${s.first_name ?? ''} ${s.last_name ?? ''}`.toLowerCase().includes(search.toLowerCase())
                )
                .map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                    onClick={() => {
                      onChange(s.id);
                      setOpen(false);
                    }}
                  >
                    {assigneeId === s.id && <Check className="h-4 w-4" />}
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-xs flex-shrink-0">
                      {getUserInitials(s.first_name, s.last_name)}
                    </div>
                    <span className="truncate">
                      {s.first_name} {s.last_name}
                    </span>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
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

export function TaskIssueEntityPill({
  issue,
  issues,
  onChange,
  collapsed,
}: {
  issue?: { id: string; name: string | null } | null;
  issues: { id: string; name: string | null }[];
  onChange: (issueId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-2">
          <Input
            placeholder="Search issues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <ScrollArea className="h-[240px]">
            <div className="space-y-0.5 pr-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {!issue && <Check className="h-4 w-4" />}
                <span>No issue</span>
              </button>
              {issues
                .filter((i) => !search.trim() || (i.name || '').toLowerCase().includes(search.toLowerCase()))
                .map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                    onClick={() => {
                      onChange(i.id);
                      setOpen(false);
                    }}
                  >
                    {issue?.id === i.id && <Check className="h-4 w-4" />}
                    <span className="truncate">{i.name || 'Untitled issue'}</span>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function TaskProjectEntityPill({
  project,
  projects,
  onChange,
  collapsed,
}: {
  project?: { id: string; name: string | null } | null;
  projects: { id: string; name: string | null }[];
  onChange: (projectId: string | null) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[320px]" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-2">
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <ScrollArea className="h-[240px]">
            <div className="space-y-0.5 pr-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {!project && <Check className="h-4 w-4" />}
                <span>No project</span>
              </button>
              {projects
                .filter((p) => !search.trim() || (p.name || '').toLowerCase().includes(search.toLowerCase()))
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                    onClick={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    {project?.id === p.id && <Check className="h-4 w-4" />}
                    <span className="truncate">{p.name || 'Untitled project'}</span>
                  </button>
                ))}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
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
    return scored.map(({ item }) => item);
  }, [issues, search]);

  const projectMatches = useMemo(() => {
    const scored = projects
      .map((item) => ({ item, score: getMatchScore(item.name, search) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => b.score - a.score);
    return scored.map(({ item }) => item);
  }, [projects, search]);

  const issueTopScore = issueMatches.length > 0 ? getMatchScore(issueMatches[0].name, search) : -1;
  const projectTopScore = projectMatches.length > 0 ? getMatchScore(projectMatches[0].name, search) : -1;
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
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
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[360px]" align="start" onClick={(e) => e.stopPropagation()}>
        <div className="p-2">
          <Input
            placeholder="Search issues and projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 mb-2"
          />
          <ScrollArea className="h-[260px]">
            <div className="space-y-2 pr-2">
              <button
                type="button"
                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                onClick={() => {
                  onChange(null);
                  setOpen(false);
                }}
              >
                {!activeLink && <Check className="h-4 w-4" />}
                <span>No link</span>
              </button>

              {orderedGroups.map((group) => {
                const items = group.type === 'issue' ? issueMatches : projectMatches;
                if (items.length === 0) return null;

                return (
                  <div key={group.type} className="space-y-0.5">
                    <div className="px-2 pt-1 pb-0.5 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">
                      {group.label}
                    </div>
                    {items.map((item) => (
                      <button
                        key={`${group.type}-${item.id}`}
                        type="button"
                        className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded hover:bg-muted text-left"
                        onClick={() => {
                          onChange({ type: group.type, id: item.id, name: item.name });
                          setOpen(false);
                        }}
                      >
                        {activeLink?.type === group.type && activeLink.id === item.id && (
                          <Check className="h-4 w-4" />
                        )}
                        {group.type === 'issue' ? (
                          <Link2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        ) : (
                          <FolderKanban className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        )}
                        <span className="truncate">{item.name || `Untitled ${group.type}`}</span>
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
}
