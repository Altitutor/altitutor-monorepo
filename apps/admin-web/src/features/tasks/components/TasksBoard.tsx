'use client';

import { useState, useMemo, useCallback } from 'react';
import {
  KanbanBoard,
  type KanbanColumnDef,
  type EntityListPillColumn,
  type EntityListStatusColumn,
} from '@altitutor/ui';
import { useTasks } from '../api/queries';
import { useUpdateTask, useCreateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { TaskCard } from './TaskCard';
import { EditTaskDialog } from './EditTaskDialog';
import { CreateTaskDialog } from './CreateTaskDialog';
import {
  getStatusLabel,
  getStatusIconColor,
  getPriorityLabel,
  getPriorityIconColor,
  getEstimateLabel,
  ESTIMATE_OPTIONS,
  PRIORITY_OPTIONS,
} from '../utils/taskUtils';
import {
  TaskAssigneeEntityPill,
  TaskPriorityEntityPill,
  TaskEstimateEntityPill,
} from './fields/TaskEntityPills';
import type { TaskWithAssignee, TaskStatus, TaskPriority } from '../types';
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
  onCreateTask?: (status: TaskStatus) => void;
}

export function TasksBoard({ filters: initialFilters }: TasksBoardProps) {
  const [activeColumnKey, setActiveColumnKey] = useState<string>('status');
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createDefaultStatus, setCreateDefaultStatus] = useState<TaskStatus | undefined>(undefined);
  const [createDefaultValues, setCreateDefaultValues] = useState<any>({});

  const assigneeFilter = (filters.assignee ?? []) as string[];
  const priorityFilter = (filters.priority ?? []) as TaskPriority[];
  const statusFilter = (filters.status ?? []) as TaskStatus[];

  const { data: tasks = [], isLoading } = useTasks({
    assignedTo: assigneeFilter.length > 0 ? assigneeFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    status: statusFilter.length > 0 ? statusFilter : undefined,
    search: initialFilters?.search,
  });

  const updateTask = useUpdateTask();
  const createTask = useCreateTask();

  const handleUpdate = useCallback(
    (task: TaskWithAssignee, updates: Partial<TaskWithAssignee>) => {
      updateTask.mutate({ id: task.id, updates: updates as any });
    },
    [updateTask]
  );

  const { staff: staffList } = useStaffSearch('', true);

  const assigneeFilterOptions = useMemo(
    () =>
      staffList.map((s) => ({
        value: s.id as unknown,
        label: `${s.first_name} ${s.last_name}`,
      })),
    [staffList]
  );

  const statusColumn: EntityListStatusColumn<TaskWithAssignee, TaskStatus> = useMemo(() => ({
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
    onStatusChange: (task, value) => handleUpdate(task, { status: value }),
  }), [handleUpdate]);

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
        compare: (a, b) => (Number(b) ?? 0) - (Number(a) ?? 0),
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
    ],
    [staffList, assigneeFilterOptions, handleUpdate]
  );

  const columnDefs: KanbanColumnDef<TaskWithAssignee, any>[] = useMemo(() => [
    {
      key: 'status',
      label: 'Status',
      getValue: (t) => t.status,
      options: STATUS_OPTIONS,
      onValueChange: (t, v) => handleUpdate(t, { status: v }),
    },
    {
      key: 'priority',
      label: 'Priority',
      getValue: (t) => t.priority ?? 0,
      options: PRIORITY_OPTIONS,
      onValueChange: (t, v) => handleUpdate(t, { priority: v }),
    },
    {
      key: 'assignee',
      label: 'Assignee',
      getValue: (t) => t.assigned_to ?? '__null__',
      options: [
        { value: '__null__', label: 'Unassigned' },
        ...staffList.map(s => ({ value: s.id, label: `${s.first_name} ${s.last_name}` }))
      ],
      onValueChange: (t, v) => handleUpdate(t, { assigned_to: v === '__null__' ? null : v }),
    }
  ], [handleUpdate, staffList]);

  const groupByOptions = [
    { key: 'assignee', label: 'Assignee' },
    { key: 'priority', label: 'Priority' },
    { key: 'estimate', label: 'Estimate' },
    { key: 'status', label: 'Status' },
  ];

  const sortByOptions = [
    { key: 'estimate', label: 'Estimate' },
    { key: 'priority', label: 'Priority' },
    { key: 'status', label: 'Status' },
  ];

  const handleAdd = useCallback(
    (columnValue: any) => {
      const defaults: any = {
        status: 'todo' as TaskStatus,
      };

      if (activeColumnKey === 'status') {
        defaults.status = columnValue as TaskStatus;
      } else if (activeColumnKey === 'priority') {
        defaults.priority = columnValue as number;
      } else if (activeColumnKey === 'assignee') {
        defaults.assignedTo = columnValue === '__null__' ? null : (columnValue as string);
      }

      setCreateDefaultStatus(defaults.status);
      setCreateDefaultValues(defaults);
      setIsCreateDialogOpen(true);
    },
    [activeColumnKey]
  );

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
    return valueKey === '__null__' ? 'No value' : valueKey;
  }, [staffList]);

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
        statusColumn={statusColumn}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
        filters={filters}
        onFiltersChange={setFilters}
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
      />
    </>
  );
}
