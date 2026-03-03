'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
  type KanbanColumnDef,
  type EntityListPillColumn,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useTasks } from '../api/queries';
import { useUpdateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { useCurrentStaff } from '@/shared/hooks';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { useIssues } from '@/features/issues/api/queries';
import { useProjects } from '@/features/projects/api/queries';
import { resolveQuickFilterPlaceholders, type QuickFilter } from '@altitutor/shared';
import { TaskCard } from './TaskCard';
import { EditTaskDialog } from './EditTaskDialog';
import { CreateTaskDialog } from './CreateTaskDialog';
import {
  getStatusLabel,
  getStatusIconColor,
  getPriorityLabel,
  getEstimateLabel,
  ESTIMATE_OPTIONS,
  PRIORITY_OPTIONS,
} from '../utils/taskUtils';
import {
  TaskAssigneeEntityPill,
  TaskPriorityEntityPill,
  TaskEstimateEntityPill,
  TaskIssueEntityPill,
  TaskProjectEntityPill,
} from './fields/TaskEntityPills';
import type { TaskWithAssignee, TaskStatus, TaskPriority, TaskFilters, TaskUpdate, TaskFormData } from '../types';
import { cn } from '@/shared/utils';
import { Circle, Clock, Eye, CheckCircle } from 'lucide-react';

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

interface TasksBoardProps {
  filters?: {
    assignedTo?: string;
    priority?: number;
    search?: string;
  };
  projectId?: string;
  onCreateTask?: (status: TaskStatus) => void;
}

export function TasksBoard({ filters: initialFilters, projectId }: TasksBoardProps) {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus | undefined>(undefined);
  const [createDefaultValues, setCreateDefaultValues] = useState<Partial<TaskFormData>>({});

  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const { data: currentStaff } = useCurrentStaff();
  const currentStaffId = currentStaff?.id;

  const { data: quickFilters = [] } = useQuickFilters('tasks');
  const { data: issues = [] } = useIssues();
  const { data: projects = [] } = useProjects();

  const handleApplyQuickFilter = useCallback((qf: QuickFilter) => {
    const resolved = resolveQuickFilterPlaceholders(qf.config, currentStaffId);
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

  const { data: tasks = [], isLoading } = useTasks({
    ...filters,
    ...(projectId ? { project_id: [projectId as unknown] } : {}),
    search: initialFilters?.search,
  } as TaskFilters);

  const updateTask = useUpdateTask();
  const handleUpdate = useCallback((task: TaskWithAssignee, updates: Partial<TaskWithAssignee>) => {
    updateTask.mutate({ id: task.id, updates: updates as TaskUpdate });
  }, [updateTask]);

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

  const statusColumn: EntityListStatusColumn<TaskWithAssignee, TaskStatus> = useMemo(() => ({
    key: 'status',
    label: 'Status',
    getValue: (t) => t.status as TaskStatus,
    defaultValue: 'todo',
    filterable: true,
    options: STATUS_OPTIONS.map(opt => ({
      ...opt,
      icon: opt.value === 'backlog' ? Circle : opt.value === 'todo' ? Circle : opt.value === 'in_progress' ? Clock : opt.value === 'in_review' ? Eye : CheckCircle,
    })),
    renderBubble: (value, collapsed) => {
      const label = getStatusLabel(value);
      const iconColor = getStatusIconColor(value);
      const Icon = value === 'backlog' ? Circle : value === 'todo' ? Circle : value === 'in_progress' ? Clock : value === 'in_review' ? Eye : CheckCircle;

      if (collapsed) return <Icon className={cn('h-3 w-3', iconColor)} />;

      return (
        <span className={cn('inline-flex items-center gap-1.5 text-xs', iconColor)}>
          <Icon className="h-3 w-3" />
          {label}
        </span>
      );
    },
    onStatusChange: (task, value) => handleUpdate(task, { status: value }),
  }), [handleUpdate]);

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
            handleUpdate(item, { assigned_to: id });
            onChange(id);
          }}
        />
      ),
    },
    {
      key: 'estimate',
      label: 'Estimate',
      visibleByDefault: true,
      getValue: (t) => t.estimate ?? null,
      defaultValue: null,
      filterOptions: ESTIMATE_OPTIONS.map((o: { value: number; label: string }) => ({ value: o.value as unknown, label: o.label })),
      groupable: true,
      sortable: true,
      filterable: true,
      compare: (a, b) => (Number(a) ?? 0) - (Number(b) ?? 0),
      renderPill: (item, onChange, collapsed) => (
        <TaskEstimateEntityPill
          value={item.estimate ?? null}
          collapsed={collapsed}
          onChange={(v) => {
            handleUpdate(item, { estimate: v });
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
      filterOptions: PRIORITY_OPTIONS.map((o: { value: TaskPriority; label: string }) => ({ value: o.value as unknown, label: o.label })),
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
            handleUpdate(item, { priority: v });
            onChange(v);
          }}
        />
      ),
    },
    {
      key: 'issue_id',
      label: 'Issue',
      visibleByDefault: true,
      getValue: (t) => t.issue_id ?? null,
      defaultValue: null,
      filterOptions: issueFilterOptions,
      groupable: true,
      sortable: false,
      filterable: true,
      filterSearchable: true,
      renderPill: (item, onChange, collapsed) => (
        <TaskIssueEntityPill
          issue={item.issue ?? null}
          issues={issues.map((i) => ({ id: i.id, name: i.name }))}
          collapsed={collapsed}
          onChange={(nextIssueId) => {
            handleUpdate(item, { issue_id: nextIssueId, project_id: nextIssueId ? null : item.project_id });
            onChange(nextIssueId);
          }}
        />
      ),
    },
    {
      key: 'project_id',
      label: 'Project',
      visibleByDefault: true,
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
            handleUpdate(item, { project_id: nextProjectId, issue_id: nextProjectId ? null : item.issue_id });
            onChange(nextProjectId);
          }}
        />
      ),
    },
  ], [staffList, assigneeFilterOptions, issueFilterOptions, projectFilterOptions, issues, projects, handleUpdate]);

  const columnDefs: KanbanColumnDef<TaskWithAssignee, unknown>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      getValue: (t) => t.status,
      options: STATUS_OPTIONS,
      onValueChange: (t, v) => handleUpdate(t, { status: v as TaskStatus }),
    },
    {
      key: 'priority',
      label: 'Priority',
      getValue: (t) => t.priority ?? 0,
      options: PRIORITY_OPTIONS,
      onValueChange: (t, v) => handleUpdate(t, { priority: v as number }),
    },
    {
      key: 'assignee',
      label: 'Assignee',
      getValue: (t) => t.assigned_to ?? '__null__',
      options: [
        { value: '__null__', label: 'Unassigned' },
        ...staffList.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` })),
      ],
      onValueChange: (t, v) => handleUpdate(t, { assigned_to: v === '__null__' ? null : (v as string) }),
    }
  ], [handleUpdate, staffList]);

  const groupByOptions = [
    { key: 'assignee', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'status', label: 'Status' },
    { key: 'project_id', label: 'Project' },
  ];

  const sortByOptions = [
    { key: 'estimate', label: 'Estimate' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  const handleAdd = useCallback((columnValue: unknown) => {
    const defaults: Partial<TaskFormData> = { status: 'todo' as TaskStatus };
    if (activeColumnKey === 'status') {
      defaults.status = columnValue as TaskStatus;
    } else if (activeColumnKey === 'priority') {
      defaults.priority = columnValue as number;
    } else if (activeColumnKey === 'assignee') {
      defaults.assignedTo = columnValue === '__null__' ? null : (columnValue as string);
    }

    if (projectId) defaults.projectId = projectId;

    setCreateDefaultStatus(defaults.status);
    setCreateDefaultValues(defaults);
    setIsCreateDialogOpen(true);
  }, [activeColumnKey, projectId]);

  const getGroupLabel = useCallback((columnKey: string, valueKey: string) => {
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
  }, [staffList, issues, projects]);

  const handleSortChange = useCallback((key: string, direction: 'asc' | 'desc') => {
    setSortBy(key);
    setSortDirection(direction);
  }, []);

  return (
    <>
      <KanbanBoard<TaskWithAssignee>
        items={tasks}
        getItemId={(t) => t.id}
        columnDefs={columnDefs}
        activeColumnKey={activeColumnKey}
        onActiveColumnKeyChange={setActiveColumnKey}
        renderCard={(t, visiblePillKeys) => (
          <TaskCard
            task={t}
            visiblePillKeys={visiblePillKeys}
            onClick={() => {
              setSelectedTaskId(t.id);
              setIsEditDialogOpen(true);
            }}
          />
        )}
        statusColumn={statusColumn as EntityListStatusColumn<TaskWithAssignee, unknown>}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        sortBy={sortBy}
        sortDirection={sortDirection}
        onSortChange={handleSortChange}
        filters={filters}
        onFiltersChange={setFilters}
        quickFilters={quickFilters}
        onApplyQuickFilter={handleApplyQuickFilter}
        getGroupLabel={getGroupLabel}
        onAdd={handleAdd}
        isLoading={isLoading}
        emptyMessage="No tasks found"
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

      <CreateTaskDialog
        isOpen={isCreateDialogOpen}
        onClose={() => setIsCreateDialogOpen(false)}
        defaultStatus={createDefaultStatus}
        defaultValues={createDefaultValues}
        project={projectId ? projects.find((p) => p.id === projectId) || null : null}
      />
    </>
  );
}
