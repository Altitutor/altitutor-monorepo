'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  EntityList,
  type EntityListPillColumn,
  type EntityListStatusColumn,
  RichTextEditor,
} from '@altitutor/ui';
import { useTasks } from '../api/queries';
import { useUpdateTask, useCreateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { useCurrentStaff } from '@/features/staff/hooks/useStaffQuery';
import { useIssues } from '@/features/issues/api/queries';
import { TextWithTags } from '@/shared/components/TextWithTags';
import { EditTaskDialog } from './EditTaskDialog';
import {
  TaskAssigneeEntityPill,
  TaskPriorityEntityPill,
  TaskEstimateEntityPill,
  TaskIssueEntityPill,
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
import { Clock, Circle, CheckCircle, Eye } from 'lucide-react';
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

export function TasksList({ 
  issueId, 
  compact = false,
  hideToolbar = false,
  showIssuePill = true,
  noPadding = true,
}: { 
  issueId?: string; 
  compact?: boolean;
  hideToolbar?: boolean;
  showIssuePill?: boolean;
  noPadding?: boolean;
} = {}) {
  // Default filters: show only todo, in_progress, and in_review
  const [filters, setFilters] = useState<Record<string, unknown[]>>({
    status: ['todo', 'in_progress', 'in_review'],
  });
  
  // Use useMemo to combine initial issue filter with active filters
  const effectiveFilters = useMemo(() => ({
    ...filters,
    ...(issueId ? { issue_id: [issueId as unknown] } : {})
  }), [filters, issueId]);

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  
  // Default groupBy: status
  const [groupBy, setGroupBy] = useState<string | null>('status');
  
  // Default sortBy: priority ascending
  const [sortBy, setSortBy] = useState<string>('priority');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  
  const { data: currentStaff } = useCurrentStaff();
  const currentStaffId = currentStaff?.id;

  const { data: quickFilters = [] } = useQuickFilters('tasks');
  const { data: issues = [] } = useIssues();

  const handleApplyQuickFilter = useCallback((qf: QuickFilter) => {
    const resolved = resolveQuickFilterPlaceholders(qf.config as any, currentStaffId);
    
    // Normalize task assignment keys to 'assignee' which the UI expects for its pills
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

  const filteredTasks = useMemo(() => {
    // Client-side filtering for fields not handled by server-side query if any
    // For now, let's assume the server handles status, assigned_to, priority, and dynamic fields
    return tasks;
  }, [tasks]);

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const handleStatusChange = useCallback(
    (task: TaskWithAssignee, value: TaskStatus) => {
      updateTask.mutate({ id: task.id, updates: { status: value } });
    },
    [updateTask]
  );

  const handlePriorityChange = useCallback(
    (task: TaskWithAssignee, value: TaskPriority) => {
      updateTask.mutate({ id: task.id, updates: { priority: value } });
    },
    [updateTask]
  );

  const handleEstimateChange = useCallback(
    (task: TaskWithAssignee, value: number | null) => {
      updateTask.mutate({ id: task.id, updates: { estimate: value } });
    },
    [updateTask]
  );

  const handleAssigneeChange = useCallback(
    (task: TaskWithAssignee, staffId: string | null) => {
      updateTask.mutate({ id: task.id, updates: { assigned_to: staffId } });
    },
    [updateTask]
  );
  const handleIssueChange = useCallback(
    (task: TaskWithAssignee, nextIssueId: string | null) => {
      updateTask.mutate({ id: task.id, updates: { issue_id: nextIssueId } });
    },
    [updateTask]
  );

  const handleAdd = useCallback(
    (data: { name: string; description?: string } & Record<string, unknown>) => {
      createTask.mutate({
        title: data.name,
        description: data.description,
        status: (data.status as TaskStatus) || 'todo',
        assigned_to: data.assignee as string | null,
        priority: data.priority as number | null,
        estimate: data.estimate as number | null,
        issue_id: issueId,
      });
    },
    [createTask, issueId]
  );

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
              : opt.value === 'done'
                ? CheckCircle
                : Circle
    })),
    renderBubble: (value, collapsed) => {
      const label = getStatusLabel(value);
      const iconColor = getStatusIconColor(value);
      const Icon =
        value === 'backlog'
          ? Circle
          : value === 'todo'
            ? Circle
            : value === 'in_progress'
              ? Clock
              : value === 'in_review'
                ? Eye
                : value === 'done'
                  ? CheckCircle
                  : Circle;
      
      if (collapsed) {
        return <Icon className={cn("h-3 w-3", iconColor)} />;
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
    () =>
      staffList.map((s) => ({
        value: s.id as unknown,
        label: `${s.first_name} ${s.last_name}`,
      })),
    [staffList]
  );
  const issueFilterOptions = useMemo(
    () =>
      issues.map((issue) => ({
        value: issue.id as unknown,
        label: issue.name || 'Untitled issue',
      })),
    [issues]
  );

  const rightPills: EntityListPillColumn<TaskWithAssignee, unknown>[] = useMemo(
    () => [
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
      ...(showIssuePill
        ? [{
            key: 'issue_id',
            label: 'Issue',
            visibleByDefault: true,
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
          } as EntityListPillColumn<TaskWithAssignee, unknown>]
        : []),
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
    ],
    [
      staffList,
      issues,
      showIssuePill,
      assigneeFilterOptions,
      issueFilterOptions,
      handleAssigneeChange,
      handleIssueChange,
      handleEstimateChange,
      handlePriorityChange,
    ]
  );

  const groupByOptions = [
    { key: 'assignee', label: 'Assignee' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
  ];

  const sortByOptions = [
    { key: 'estimate', label: 'Estimate' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  // Custom group ordering for status: backlog, todo, in_progress, in_review, done
  const getGroupOrder = useCallback((columnKey: string, valueKey: string): number => {
    if (columnKey === 'status') {
      const statusOrder: Record<string, number> = {
        'backlog': 0,
        'todo': 1,
        'in_progress': 2,
        'in_review': 3,
        'done': 4,
        '__null__': 999,
      };
      return statusOrder[valueKey] ?? 999;
    }
    return 0; // Default: alphabetical ordering
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
          placeholder: "Add task description..."
        }}
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
