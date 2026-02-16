'use client';

import { useState, useMemo, useCallback } from 'react';
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
import { User, Check } from 'lucide-react';
import { useTasks } from '../api/queries';
import { useUpdateTask, useCreateTask } from '../api/mutations';
import { useStaffSearch } from '../hooks/useStaffSearch';
import { TaskTextWithTags } from './fields/TaskTextWithTags';
import { EditTaskDialog } from './EditTaskDialog';
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

  const assigneeFilter = (filters.assignee ?? []) as string[];
  const priorityFilter = (filters.priority ?? []) as TaskPriority[];
  const estimateFilter = (filters.estimate ?? []) as number[];

  const { data: tasks = [], isLoading } = useTasks({
    assignedTo: assigneeFilter.length > 0 ? assigneeFilter : undefined,
    priority: priorityFilter.length > 0 ? priorityFilter : undefined,
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
    (partial: { name: string } & Record<string, unknown>) => {
      createTask.mutate({
        title: partial.name,
        status: 'backlog' as const,
      });
    },
    [createTask]
  );

  const statusColumn: EntityListStatusColumn<TaskWithAssignee, TaskStatus> = {
    key: 'status',
    getValue: (t) => t.status as TaskStatus,
    options: STATUS_OPTIONS,
    renderBubble: (value) => {
      const label = getStatusLabel(value);
      const iconColor = getStatusIconColor(value);
      const Icon =
        value === 'backlog'
          ? Circle
          : value === 'in_progress'
            ? Clock
            : value === 'in_review'
              ? Eye
              : value === 'done'
                ? CheckCircle
                : Circle;
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
        filterOptions: assigneeFilterOptions,
        groupable: true,
        sortable: false,
        filterable: true,
        renderPill: (item, onChange) => (
          <TaskListAssigneePill
            task={item}
            staffList={staffList}
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
        filterOptions: ESTIMATE_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
        groupable: true,
        sortable: true,
        filterable: true,
        compare: (a, b) => (Number(a) ?? 0) - (Number(b) ?? 0),
        renderPill: (item, onChange) => (
          <TaskListEstimatePill
            value={item.estimate ?? null}
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
        filterOptions: PRIORITY_OPTIONS.map((o) => ({ value: o.value as unknown, label: o.label })),
        groupable: false,
        sortable: true,
        filterable: true,
        compare: (a, b) => (Number(b) ?? 0) - (Number(a) ?? 0),
        renderPill: (item, onChange) => (
          <TaskListPriorityPill
            value={(item.priority ?? 0) as TaskPriority}
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
          return valueKey === '__null__' ? 'No value' : valueKey;
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

function TaskListAssigneePill({
  task,
  staffList,
  onChange,
}: {
  task: TaskWithAssignee;
  staffList: { id: string; first_name: string | null; last_name: string | null }[];
  onChange: (staffId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const assignee = task.assignee;
  const initials = assignee ? getUserInitials(assignee.first_name, assignee.last_name) : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'inline-flex items-center gap-1.5 h-8 px-3 text-xs border rounded-full',
            'bg-background hover:bg-muted/80 transition-colors'
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {assignee ? (
            <>
              <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-[10px] font-medium flex-shrink-0">
                {initials}
              </div>
              <span className="truncate max-w-[80px]">
                {assignee.first_name} {assignee.last_name}
              </span>
            </>
          ) : (
            <>
              <User className="h-3 w-3 text-muted-foreground" />
              <span className="text-muted-foreground">Assign</span>
            </>
          )}
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
                {!assignee && <Check className="h-4 w-4" />}
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
                    {assignee?.id === s.id && <Check className="h-4 w-4" />}
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

function TaskListPriorityPill({
  value,
  onChange,
}: {
  value: TaskPriority;
  onChange: (v: TaskPriority) => void;
}) {
  const label = getPriorityLabel(value);
  const iconColor = getPriorityIconColor(value);
  const Icon =
    value === 0 ? Circle : value === 2 ? AlertTriangle : value === 4 ? Info : AlertCircle;

  return (
    <Select
      value={String(value)}
      onValueChange={(v) => onChange(Number(v) as TaskPriority)}
    >
      <SelectTrigger
        className="h-8 px-3 text-xs border rounded-full w-auto gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Icon className={cn('h-3 w-3 flex-shrink-0', iconColor)} />
        <span className="truncate">{label}</span>
      </SelectTrigger>
      <SelectContent>
        {PRIORITY_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TaskListEstimatePill({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const label = value ? getEstimateLabel(value) : null;

  return (
    <Select
      value={value ? String(value) : 'none'}
      onValueChange={(v) => onChange(v === 'none' ? null : Number(v))}
    >
      <SelectTrigger
        className="h-8 px-3 text-xs border rounded-full w-auto gap-1.5"
        onClick={(e) => e.stopPropagation()}
      >
        <Gauge className="h-3 w-3 text-muted-foreground flex-shrink-0" />
        <span className="truncate">{label || 'Estimate'}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">None</SelectItem>
        {ESTIMATE_OPTIONS.map((o) => (
          <SelectItem key={o.value} value={String(o.value)}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
