'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  EntityList,
  type EntityListPillColumn,
  type EntityListStatusColumn,
  type EntityListLeftIcon,
} from '@altitutor/ui';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { User, Check, ChevronDown } from 'lucide-react';
import { useTasks } from '../api/queries';
import { useUpdateTask, useCreateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { TaskTextWithTags } from './fields/TaskTextWithTags';
import { EditTaskDialog } from './EditTaskDialog';
import { TaskEditor } from './TaskEditor';
import {
  TaskAssigneeEntityPill,
  TaskPriorityEntityPill,
  TaskEstimateEntityPill,
} from './fields/TaskEntityPills';
import {
  getStatusLabel,
  getStatusIconColor,
  getPriorityLabel,
  getPriorityIconColor,
  getEstimateLabel,
  getUserInitials,
  ESTIMATE_OPTIONS,
} from '../utils/taskUtils';
import type { TaskWithAssignee } from '../types';
import type { TaskStatus, TaskPriority } from '../types';
import { cn } from '@/shared/utils';
import { Clock, Circle, CheckCircle, Eye } from 'lucide-react';
import { AlertCircle, AlertTriangle, Info } from 'lucide-react';
import { Gauge } from 'lucide-react';
import { useQuickFilters } from '@/features/quick-filters/hooks/useQuickFilters';
import { resolveQuickFilterPlaceholders, type QuickFilter } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

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

export function TasksList() {
  const [filters, setFilters] = useState<Record<string, unknown[]>>({});
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const { data: quickFilters = [] } = useQuickFilters('tasks');

  useEffect(() => {
    const fetchUser = async () => {
      const supabase = getSupabaseClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    fetchUser();
  }, []);

  const handleApplyQuickFilter = useCallback((qf: QuickFilter) => {
    const resolved = resolveQuickFilterPlaceholders(qf.config as any, currentUserId || undefined);
    setFilters(resolved);
  }, [currentUserId]);

  const assigneeFilter = (filters.assignee ?? []) as string[];
  const priorityFilter = (filters.priority ?? []) as TaskPriority[];
  const estimateFilter = (filters.estimate ?? []) as number[];
  const statusFilter = (filters.status ?? []) as TaskStatus[];

  const { data: tasks = [], isLoading } = useTasks({
    assignedTo: assigneeFilter.length > 0 ? assigneeFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
    status: statusFilter.length > 0 ? statusFilter : undefined,
  });

  const filteredTasks = useMemo(() => {
    if (estimateFilter.length === 0) return tasks;
    return tasks.filter((t) => t.estimate != null && estimateFilter.includes(t.estimate));
  }, [tasks, estimateFilter]);

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

  const handleAdd = useCallback(
    (data: { name: string; description?: string } & Record<string, unknown>) => {
      createTask.mutate({
        title: data.name,
        description: data.description,
        status: (data.status as TaskStatus) || 'todo',
        assigned_to: data.assignee as string | null,
        priority: data.priority as number | null,
        estimate: data.estimate as number | null,
      });
    },
    [createTask]
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
      assigneeFilterOptions,
      handleAssigneeChange,
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

  return (
    <>
      <EntityList<TaskWithAssignee>
        items={filteredTasks}
        getItemId={(t) => t.id}
        renderName={(t) => <TaskTextWithTags text={t.title} />}
        statusColumn={statusColumn as EntityListStatusColumn<TaskWithAssignee>}
        rightPills={rightPills}
        groupByOptions={groupByOptions}
        sortByOptions={sortByOptions}
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
          return valueKey === '__null__' ? 'No value' : valueKey;
        }}
        descriptionConfig={{
          enabled: true,
          renderEditor: ({ value, onChange, placeholder, ref }) => (
            <TaskEditor
              ref={ref}
              content={value}
              onChange={onChange}
              placeholder={placeholder}
              className="min-h-[60px]"
            />
          ),
          placeholder: "Add task description..."
        }}
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
