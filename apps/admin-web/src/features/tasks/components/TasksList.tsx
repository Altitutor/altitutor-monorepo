'use client';

import { useState, useMemo, useCallback, useLayoutEffect, useRef, useEffect } from 'react';
import {
  EntityList,
  EntityListAddRow,
  type EntityListPillColumn,
  type EntityListStatusColumn,
  type EntityListAddRowRenderProps,
  RichTextEditor,
} from '@altitutor/ui';
import { useTasks } from '../api/queries';
import { useUpdateTask, useCreateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { useTaskSearch, type TaskSearchResult } from '../hooks/useTaskSearch';
import { useCurrentStaff } from '@/shared/hooks';
import { useIssues } from '@/features/issues/api/queries';
import { useProjects } from '@/features/projects/api/queries';
import { TextWithTags } from '@/shared/components/TextWithTags';
import { EditTaskDialog } from './EditTaskDialog';
import {
  TaskAssigneeEntityPill,
  TaskPriorityEntityPill,
  TaskEstimateEntityPill,
  TaskLinkEntityPill,
  TaskIssueEntityPill,
  TaskProjectEntityPill,
} from './fields/TaskEntityPills';
import {
  getStatusLabel,
  getStatusIconColor,
  getPriorityLabel,
  getEstimateLabel,
  ESTIMATE_OPTIONS,
} from '../utils/taskUtils';
import type { TaskWithAssignee } from '../types';
import type { TaskStatus, TaskPriority, TaskFilters } from '../types';
import { cn } from '@/shared/utils';
import { Clock, Circle, CheckCircle, Eye, CheckSquare, Loader2 } from 'lucide-react';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { resolveQuickFilterPlaceholders, type QuickFilter } from '@altitutor/shared';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

/** Autocomplete dropdown for linking an existing task to the current issue/project. Only shown when there are suggestions. */
function TaskLinkAutocomplete({
  tasks,
  isLoading,
  position,
  onSelect,
  onClose,
  getStatusLabel,
}: {
  tasks: TaskSearchResult[];
  isLoading: boolean;
  position: { top: number; left: number } | null;
  onSelect: (taskId: string) => void;
  onClose: () => void;
  getStatusLabel: (status: string) => string;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const showDropdown = position !== null && (tasks.length > 0 || isLoading);

  useLayoutEffect(() => {
    if (tasks.length > 0) setSelectedIndex(0);
  }, [tasks.length]);

  useEffect(() => {
    if (!showDropdown || tasks.length === 0) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev < tasks.length - 1 ? prev + 1 : prev));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : 0));
      } else if (e.key === 'Enter' && tasks[selectedIndex]) {
        e.preventDefault();
        onSelect(tasks[selectedIndex].id);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showDropdown, tasks, selectedIndex, onSelect, onClose]);

  if (!showDropdown) return null;

  return (
    <div
      ref={containerRef}
      role="listbox"
      className="fixed z-[200] bg-popover border rounded-lg shadow-lg max-h-[280px] overflow-y-auto min-w-[240px] max-w-[400px]"
      style={
        position
          ? { top: position.top, left: position.left, position: 'fixed' as const }
          : undefined
      }
      onMouseDown={(e) => e.preventDefault()}
    >
      {isLoading && (
        <div className="flex items-center justify-center p-4">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {!isLoading && tasks.length > 0 && (
        <div className="py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-2">
            <CheckSquare className="h-3 w-3" />
            Link existing task
          </div>
          {tasks.map((task, idx) => {
            const isSelected = idx === selectedIndex;
            return (
              <button
                key={task.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  'w-full flex items-start gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors text-left',
                  isSelected ? 'bg-brand-lightBlue/10 dark:bg-brand-lightBlue/20' : 'hover:bg-muted'
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onSelect(task.id);
                }}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                <CheckSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0 text-left">
                  <div className="font-medium text-sm">{task.title || 'Untitled'}</div>
                  {task.status && (
                    <div className="text-xs text-muted-foreground">
                      {getStatusLabel(task.status)}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Add row that shows task-search autocomplete when typing; on select, links task to issue/project. */
function TaskListAddRowWithSearch({
  addRowProps,
  issueId,
  projectId,
  linkedTaskIds,
  onLinkTask,
}: {
  addRowProps: EntityListAddRowRenderProps<TaskWithAssignee>;
  issueId?: string;
  projectId?: string;
  linkedTaskIds: string[];
  onLinkTask: (taskId: string) => void;
}) {
  const { addName, setAddName, inputRef } = addRowProps;
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);

  const { tasks, isLoading } = useTaskSearch(
    addName,
    !!(issueId || projectId)
  );
  const suggestions = useMemo(
    () => tasks.filter((t) => !linkedTaskIds.includes(t.id)),
    [tasks, linkedTaskIds]
  );

  const showAutocomplete = addName.trim() !== '' && (suggestions.length > 0 || isLoading);

  useLayoutEffect(() => {
    if (!showAutocomplete || !inputRef?.current) {
      setPosition(null);
      return;
    }
    const rect = inputRef.current.getBoundingClientRect();
    setPosition({
      top: rect.bottom + 4,
      left: rect.left,
    });
  }, [showAutocomplete, addName, suggestions.length, isLoading]);

  const handleSelect = useCallback(
    (taskId: string) => {
      onLinkTask(taskId);
      setAddName('');
    },
    [onLinkTask, setAddName]
  );

  return (
    <>
      <EntityListAddRow {...addRowProps} />
      <TaskLinkAutocomplete
        tasks={suggestions}
        isLoading={isLoading}
        position={position}
        onSelect={handleSelect}
        onClose={() => setAddName('')}
        getStatusLabel={(s) => getStatusLabel(s as TaskStatus)}
      />
    </>
  );
}

export function TasksList({
  issueId,
  projectId,
  compact = false,
  hideToolbar = false,
  showIssuePill = true,
  showProjectPill = true,
  showLinkPill = true,
  noPadding = true,
}: {
  issueId?: string;
  projectId?: string;
  compact?: boolean;
  hideToolbar?: boolean;
  showIssuePill?: boolean;
  showProjectPill?: boolean;
  showLinkPill?: boolean;
  noPadding?: boolean;
} = {}) {
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});

  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...(issueId ? { issue_id: [issueId as unknown] } : {}),
    ...(projectId ? { project_id: [projectId as unknown] } : {}),
  }), [filters, issueId, projectId]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string | null>('status');
  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: currentStaff } = useCurrentStaff();
  const currentStaffId = currentStaff?.id;

  const { data: quickFilters = [] } = useQuickFilters('tasks');
  const { data: issues = [] } = useIssues();
  const { data: projects = [] } = useProjects();

  const handleApplyQuickFilter = useCallback((qf: QuickFilter) => {
    const resolved = resolveQuickFilterPlaceholders(qf.config as any, currentStaffId);

    if (resolved.assigned_to && !resolved.assignee) {
      resolved.assignee = resolved.assigned_to;
      delete resolved.assigned_to;
    }
    if (resolved.assignedTo && !resolved.assignee) {
      resolved.assignee = resolved.assignedTo;
      delete resolved.assignedTo;
    }

    setFilters(resolved);
  }, [currentStaffId]);

  const { data: tasks = [], isLoading } = useTasks(effectiveFilters as TaskFilters);
  const filteredTasks = useMemo(() => tasks, [tasks]);

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const handleStatusChange = useCallback((task: TaskWithAssignee, value: TaskStatus) => {
    updateTask.mutate({ id: task.id, updates: { status: value } });
  }, [updateTask]);

  const handlePriorityChange = useCallback((task: TaskWithAssignee, value: TaskPriority) => {
    updateTask.mutate({ id: task.id, updates: { priority: value } });
  }, [updateTask]);

  const handleEstimateChange = useCallback((task: TaskWithAssignee, value: number | null) => {
    updateTask.mutate({ id: task.id, updates: { estimate: value } });
  }, [updateTask]);

  const handleAssigneeChange = useCallback((task: TaskWithAssignee, staffId: string | null) => {
    updateTask.mutate({ id: task.id, updates: { assigned_to: staffId } });
  }, [updateTask]);

  const handleIssueChange = useCallback((task: TaskWithAssignee, nextIssueId: string | null) => {
    updateTask.mutate({ id: task.id, updates: { issue_id: nextIssueId, project_id: nextIssueId ? null : task.project_id } });
  }, [updateTask]);

  const handleProjectChange = useCallback((task: TaskWithAssignee, nextProjectId: string | null) => {
    updateTask.mutate({ id: task.id, updates: { project_id: nextProjectId, issue_id: nextProjectId ? null : task.issue_id } });
  }, [updateTask]);

  const handleLinkChange = useCallback((
    task: TaskWithAssignee,
    link: { type: 'issue' | 'project'; id: string; name: string | null } | null
  ) => {
    if (!link) {
      updateTask.mutate({ id: task.id, updates: { issue_id: null, project_id: null } });
      return;
    }

    if (link.type === 'issue') {
      updateTask.mutate({ id: task.id, updates: { issue_id: link.id, project_id: null } });
    } else {
      updateTask.mutate({ id: task.id, updates: { project_id: link.id, issue_id: null } });
    }
  }, [updateTask]);

  const handleLinkTaskFromSearch = useCallback(
    (taskId: string) => {
      if (issueId) {
        updateTask.mutate({ id: taskId, updates: { issue_id: issueId, project_id: null } });
      } else if (projectId) {
        updateTask.mutate({ id: taskId, updates: { project_id: projectId, issue_id: null } });
      }
    },
    [issueId, projectId, updateTask]
  );

  const handleAdd = useCallback(async (data: { name: string; description?: string } & Record<string, unknown>) => {
    const createdTask = await createTask.mutateAsync({
      title: data.name,
      description: data.description,
      status: (data.status as TaskStatus) || 'todo',
      assigned_to: data.assignee as string | null,
      priority: data.priority as number | null,
      estimate: data.estimate as number | null,
      issue_id: issueId || null,
      project_id: projectId || null,
      created_by: currentStaff?.id ?? null,
    });

    // Enforce scoped linkage in project task tabs even if upstream add payload changes.
    if (projectId && createdTask.project_id !== projectId) {
      updateTask.mutate({ id: createdTask.id, updates: { project_id: projectId, issue_id: null } });
    }
  }, [createTask, updateTask, issueId, projectId, currentStaff?.id]);

  const statusColumn: EntityListStatusColumn<TaskWithAssignee, TaskStatus> = {
    key: 'status',
    label: 'Status',
    getValue: (t) => t.status as TaskStatus,
    defaultValue: 'todo',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'backlog'
        ? Circle
        : opt.value === 'todo'
          ? Circle
          : opt.value === 'in_progress'
            ? Clock
            : opt.value === 'in_review'
              ? Eye
              : CheckCircle
    })),
    renderBubble: (value, collapsed) => {
      const label = getStatusLabel(value);
      const iconColor = getStatusIconColor(value);
      const Icon = value === 'backlog' ? Circle : value === 'todo' ? Circle : value === 'in_progress' ? Clock : value === 'in_review' ? Eye : CheckCircle;

      if (collapsed) {
        return <Icon className={cn('h-3 w-3', iconColor)} />;
      }

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', iconColor)}>
          <Icon className="h-3 w-3" />
          {label}
        </span>
      );
    },
    onStatusChange: handleStatusChange,
  };

  const { staff: staffList } = useStaffSearch('', true);

  const assigneeFilterOptions = useMemo(
    () => staffList.map((s) => ({ value: s.id as unknown, label: `${s.first_name} ${s.last_name}` })),
    [staffList]
  );

  const issueFilterOptions = useMemo(
    () => issues.map((issue) => ({ value: issue.id as unknown, label: issue.name || 'Untitled issue' })),
    [issues]
  );

  const projectFilterOptions = useMemo(
    () => projects.map((project) => ({ value: project.id as unknown, label: project.name || 'Untitled project' })),
    [projects]
  );

  const rightPills: EntityListPillColumn<TaskWithAssignee, unknown>[] = useMemo(() => [
    {
      key: 'assignee',
      label: 'Assignee',
      visibleByDefault: true,
      getValue: (t) => t.assigned_to ?? null,
      defaultValue: null,
      filterOptions: assigneeFilterOptions,
      groupable: true,
      sortable: false,
      filterable: true,
      renderPill: (item, onChange, collapsed) => (
        <TaskAssigneeEntityPill
          task={item}
          staffList={staffList}
          collapsed={collapsed}
          onChange={(id) => {
            handleAssigneeChange(item, id);
            onChange(id);
          }}
        />
      ),
    },
    ...(showLinkPill ? [{
      key: 'link_entity',
      label: 'Link',
      visibleByDefault: true,
      getValue: (t: TaskWithAssignee) => t.issue_id ?? t.project_id ?? null,
      defaultValue: null,
      groupable: false,
      sortable: false,
      filterable: false,
      renderPill: (item: TaskWithAssignee, onChange: (value: unknown) => void, collapsed?: boolean) => (
        <TaskLinkEntityPill
          issue={item.issue ?? null}
          project={item.project ?? null}
          issues={issues.map((i) => ({ id: i.id, name: i.name }))}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          collapsed={collapsed}
          onChange={(link) => {
            handleLinkChange(item, link);
            onChange(link ? link.id : null);
          }}
        />
      ),
    } as EntityListPillColumn<TaskWithAssignee, unknown>] : []),
    ...(showIssuePill ? [{
      key: 'issue_id',
      label: 'Issue',
      visibleByDefault: false,
      getValue: (t: TaskWithAssignee) => t.issue_id ?? null,
      defaultValue: null,
      filterOptions: issueFilterOptions,
      groupable: true,
      sortable: false,
      filterable: true,
      filterSearchable: true,
      renderPill: (item: TaskWithAssignee, onChange: (value: unknown) => void, collapsed?: boolean) => (
        <TaskIssueEntityPill
          issue={item.issue ?? null}
          issues={issues.map((i) => ({ id: i.id, name: i.name }))}
          collapsed={collapsed}
          onChange={(nextIssueId) => {
            handleIssueChange(item, nextIssueId);
            onChange(nextIssueId);
          }}
        />
      ),
    } as EntityListPillColumn<TaskWithAssignee, unknown>] : []),
    ...(showProjectPill ? [{
      key: 'project_id',
      label: 'Project',
      visibleByDefault: false,
      getValue: (t) => t.project_id ?? null,
      defaultValue: null,
      filterOptions: projectFilterOptions,
      groupable: true,
      sortable: false,
      filterable: true,
      filterSearchable: true,
      renderPill: (item, onChange, collapsed) => (
        <TaskProjectEntityPill
          project={item.project ?? null}
          projects={projects.map((p) => ({ id: p.id, name: p.name }))}
          collapsed={collapsed}
          onChange={(nextProjectId) => {
            handleProjectChange(item, nextProjectId);
            onChange(nextProjectId);
          }}
        />
      ),
    } as EntityListPillColumn<TaskWithAssignee, unknown>] : []),
    {
      key: 'estimate',
      label: 'Estimate',
      visibleByDefault: true,
      getValue: (t) => t.estimate ?? null,
      defaultValue: null,
      filterOptions: ESTIMATE_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
      groupable: true,
      sortable: true,
      filterable: true,
      compare: (a, b) => (Number(a) ?? 0) - (Number(b) ?? 0),
      renderPill: (item, onChange, collapsed) => (
        <TaskEstimateEntityPill
          value={item.estimate ?? null}
          collapsed={collapsed}
          onChange={(v) => {
            handleEstimateChange(item, v);
            onChange(v);
          }}
        />
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      visibleByDefault: true,
      getValue: (t) => t.priority ?? 0,
      defaultValue: 0,
      filterOptions: PRIORITY_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
      groupable: true,
      sortable: true,
      filterable: true,
      alwaysAtBottom: [0],
      compare: (a, b) => {
        const pa = Number(a) || 0;
        const pb = Number(b) || 0;
        if (pa === pb) return 0;
        if (pa === 0) return 1;
        if (pb === 0) return -1;
        return pa - pb;
      },
      renderPill: (item, onChange, collapsed) => (
        <TaskPriorityEntityPill
          value={(item.priority ?? 0) as TaskPriority}
          collapsed={collapsed}
          onChange={(v) => {
            handlePriorityChange(item, v);
            onChange(v);
          }}
        />
      ),
    },
  ], [
    assigneeFilterOptions,
    issueFilterOptions,
    projectFilterOptions,
    staffList,
    issues,
    projects,
    showIssuePill,
    showProjectPill,
    showLinkPill,
    handleAssigneeChange,
    handleLinkChange,
    handleIssueChange,
    handleProjectChange,
    handleEstimateChange,
    handlePriorityChange,
  ]);

  const groupByOptions = [
    { key: 'assignee', label: 'Assignee' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'project_id', label: 'Project' },
  ];

  const sortByOptions = [
    { key: 'estimate', label: 'Estimate' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  const getGroupOrder = useCallback((columnKey: string, valueKey: string): number => {
    if (columnKey === 'status') {
      const statusOrder: Record<string, number> = {
        backlog: 0,
        todo: 1,
        in_progress: 2,
        in_review: 3,
        done: 4,
        __null__: 999,
      };
      return statusOrder[valueKey] ?? 999;
    }
    return 0;
  }, []);

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  return (
    <>
      <EntityList<TaskWithAssignee>
        items={filteredTasks}
        getItemId={(t) => t.id}
        renderName={(t) => <TextWithTags text={t.title} />}
        statusColumn={statusColumn as EntityListStatusColumn<TaskWithAssignee, unknown>}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        onAdd={handleAdd}
        onRowClick={(t) => {
          setSelectedTaskId(t.id);
          setIsEditDialogOpen(true);
        }}
        addButtonLabel="Add task"
        emptyMessage="No tasks match your filters"
        isLoading={isLoading}
        filters={filters}
        onFiltersChange={setFilters}
        quickFilters={quickFilters}
        onApplyQuickFilter={handleApplyQuickFilter}
        getGroupOrder={getGroupOrder}
        getGroupLabel={(columnKey, valueKey) => {
          if (columnKey === 'assignee') {
            if (valueKey === '__null__') return 'Unassigned';
            const s = staffList.find((x) => x.id === valueKey);
            return s ? `${s.first_name ?? ''} ${s.last_name ?? ''}`.trim() || valueKey : valueKey;
          }
          if (columnKey === 'estimate') {
            if (valueKey === '__null__') return 'No estimate';
            const label = getEstimateLabel(Number(valueKey));
            return label ?? valueKey;
          }
          if (columnKey === 'status') {
            if (valueKey === '__null__') return 'No status';
            return getStatusLabel(valueKey as TaskStatus);
          }
          if (columnKey === 'priority') {
            if (valueKey === '__null__') return 'No priority';
            return getPriorityLabel(Number(valueKey) as TaskPriority);
          }
          if (columnKey === 'issue_id') {
            if (valueKey === '__null__') return 'No issue';
            const issue = issues.find((i) => i.id === valueKey);
            return issue?.name || valueKey;
          }
          if (columnKey === 'project_id') {
            if (valueKey === '__null__') return 'No project';
            const project = projects.find((p) => p.id === valueKey);
            return project?.name || valueKey;
          }
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        descriptionConfig={{
          enabled: true,
          renderEditor: ({ value, onChange, placeholder, ref }) => (
            <RichTextEditor
              ref={ref as any}
              content={value}
              onChange={onChange}
              placeholder={placeholder}
              className="min-h-[60px]"
            />
          ),
          placeholder: 'Add task description...'
        }}
        renderAddRow={
          issueId || projectId
            ? (props) => (
                <TaskListAddRowWithSearch
                  addRowProps={props}
                  issueId={issueId}
                  projectId={projectId}
                  linkedTaskIds={filteredTasks.map((t) => t.id)}
                  onLinkTask={handleLinkTaskFromSearch}
                />
              )
            : undefined
        }
        hideToolbar={hideToolbar}
        noPadding={noPadding}
        compact={compact}
      />

      {selectedTaskId && (
        <EditTaskDialog
          isOpen={isEditDialogOpen}
          onClose={() => {
            setIsEditDialogOpen(false);
            setSelectedTaskId(null);
          }}
          taskId={selectedTaskId}
        />
      )}
    </>
  );
}
