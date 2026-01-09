'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@altitutor/ui';
import { Badge } from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Input } from '@altitutor/ui';
import { SkeletonTable } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Checkbox } from '@altitutor/ui';
import { ArrowUpDown, MoreVertical, Calendar, Search, Filter, X } from 'lucide-react';
import { useTasks } from '../api/queries';
import { useUpdateTask } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables, Database } from '@altitutor/shared';
import type { TaskStatus, TaskPriority, TaskWithAssignee } from '../types';
import { getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel, isOverdue, formatDueDate, getUserInitials } from '../utils/taskUtils';
import { cn } from '@/shared/utils/index';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@altitutor/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@altitutor/ui';
import { EditTaskDialog } from './EditTaskDialog';

interface TasksTableProps {
  filters?: {
    assignedTo?: string;
    priority?: number;
    search?: string;
  };
}

type SortField = 'title' | 'status' | 'priority' | 'due_date' | 'created_at';
type SortDirection = 'asc' | 'desc';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 0, label: 'No priority' },
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
];

const STATUS_OPTIONS: { value: TaskStatus; label: string }[] = [
  { value: 'backlog', label: 'Backlog' },
  { value: 'todo', label: 'Todo' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'in_review', label: 'In Review' },
  { value: 'done', label: 'Done' },
];

export function TasksTable({ filters: _filters }: TasksTableProps) {
  // Filter state
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState<string>('');
  const [statusFilters, setStatusFilters] = useState<TaskStatus[]>(['backlog', 'todo', 'in_progress', 'in_review']); // Default: exclude 'done'
  const [priorityFilters, setPriorityFilters] = useState<TaskPriority[]>([]);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');

  // Staff search query
  const { data: staffSearchResults } = useQuery({
    queryKey: ['staff', 'search', 'tasks', assigneeSearchQuery.trim()],
    queryFn: async () => {
      const trimmed = assigneeSearchQuery.trim();
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: trimmed.length > 0 ? trimmed : undefined,
        p_statuses: ['ACTIVE'],
        p_include_relationships: false,
        p_limit: 100,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { staff: [], total: 0 };

      const rpcData = rpcResult as { staff: any[]; total: number };
      const staff = (rpcData.staff || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        role: s.role,
        status: s.status,
        email: s.email,
        phone_number: s.phone_number,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'staff'>[];
      
      return { staff, total: rpcData.total || 0 };
    },
    enabled: assigneeSearchQuery.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const filteredStaff = staffSearchResults?.staff || [];

  // Debounce search term
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Fetch tasks with filters
  const { data: tasks = [], isLoading } = useTasks({
    status: statusFilters.length > 0 ? statusFilters : undefined,
    assignedTo: assigneeFilters.length > 0 ? assigneeFilters : undefined,
    priority: priorityFilters.length > 0 ? priorityFilters : undefined,
    search: debouncedSearchTerm.trim() || undefined,
  });

  const updateTask = useUpdateTask();
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Toggle functions
  const toggleStatusFilter = useCallback((status: TaskStatus) => {
    setStatusFilters(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  }, []);

  const togglePriorityFilter = useCallback((priority: TaskPriority) => {
    setPriorityFilters(prev => 
      prev.includes(priority) 
        ? prev.filter(p => p !== priority)
        : [...prev, priority]
    );
  }, []);

  const toggleAssigneeFilter = useCallback((staffId: string) => {
    setAssigneeFilters(prev => 
      prev.includes(staffId) 
        ? prev.filter(id => id !== staffId)
        : [...prev, staffId]
    );
  }, []);

  // Check if filters are in default state
  const isDefaultState = useMemo(() => {
    return (
      searchTerm === '' &&
      priorityFilters.length === 0 &&
      assigneeFilters.length === 0 &&
      statusFilters.length === 4 && // All except 'done'
      statusFilters.includes('backlog') &&
      statusFilters.includes('todo') &&
      statusFilters.includes('in_progress') &&
      statusFilters.includes('in_review') &&
      !statusFilters.includes('done')
    );
  }, [searchTerm, priorityFilters, assigneeFilters, statusFilters]);

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchTerm('');
    setPriorityFilters([]);
    setAssigneeFilters([]);
    setStatusFilters(['backlog', 'todo', 'in_progress', 'in_review']);
    setAssigneeSearchQuery('');
  }, []);

  const sortedTasks = useMemo(() => {
    const sorted = [...tasks];
    sorted.sort((a, b) => {
      let aValue: string | number | null;
      let bValue: string | number | null;

      switch (sortField) {
        case 'title':
          aValue = a.title.toLowerCase();
          bValue = b.title.toLowerCase();
          break;
        case 'status':
          aValue = a.status;
          bValue = b.status;
          break;
        case 'priority':
          aValue = a.priority ?? 0;
          bValue = b.priority ?? 0;
          break;
        case 'due_date':
          aValue = a.due_date ? new Date(a.due_date).getTime() : 0;
          bValue = b.due_date ? new Date(b.due_date).getTime() : 0;
          break;
        case 'created_at':
          aValue = new Date(a.created_at as string).getTime();
          bValue = new Date(b.created_at as string).getTime();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [tasks, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleStatusChange = (taskId: string, newStatus: TaskStatus) => {
    updateTask.mutate({
      id: taskId,
      updates: { status: newStatus },
    });
  };

  const handlePriorityChange = (taskId: string, newPriority: TaskPriority) => {
    updateTask.mutate({
      id: taskId,
      updates: { priority: newPriority },
    });
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (priorityFilters.length > 0) count++;
    if (assigneeFilters.length > 0) count++;
    if (statusFilters.length !== 4 || statusFilters.includes('done')) count++;
    return count;
  }, [priorityFilters, assigneeFilters, statusFilters]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              className="pl-8"
              disabled
            />
          </div>
        </div>
        <SkeletonTable />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tasks..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Clear Filters */}
        {!isDefaultState && (
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={clearAllFilters}
          >
            <X className="h-4 w-4 mr-2" />
            Clear
          </Button>
        )}

        {/* Status Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={statusFilters.length !== 4 || statusFilters.includes('done') ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Status {statusFilters.length !== 4 && `(${statusFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[200px]" align="end">
            <div className="p-3">
              <ScrollArea className="h-[250px]">
                <div className="space-y-1 pr-4">
                  {STATUS_OPTIONS.map((status) => (
                    <label
                      key={status.value}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                    >
                      <Checkbox
                        checked={statusFilters.includes(status.value)}
                        onCheckedChange={() => toggleStatusFilter(status.value)}
                      />
                      <span className="text-sm">{status.label}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Priority Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={priorityFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Priority {priorityFilters.length > 0 && `(${priorityFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[200px]" align="end">
            <div className="p-3">
              <ScrollArea className="h-[250px]">
                <div className="space-y-1 pr-4">
                  {PRIORITY_OPTIONS.map((priority) => (
                    <label
                      key={priority.value}
                      className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                    >
                      <Checkbox
                        checked={priorityFilters.includes(priority.value)}
                        onCheckedChange={() => togglePriorityFilter(priority.value)}
                      />
                      <span className="text-sm">{priority.label}</span>
                    </label>
                  ))}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>

        {/* Assignee Filter */}
        <Popover>
          <PopoverTrigger asChild>
            <Button 
              variant={assigneeFilters.length > 0 ? "secondary" : "outline"} 
              size="sm"
            >
              <Filter className="h-4 w-4 mr-2" />
              Assignee {assigneeFilters.length > 0 && `(${assigneeFilters.length})`}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[400px]" align="end">
            <div className="p-3">
              <Input
                placeholder="Search staff..."
                value={assigneeSearchQuery}
                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                className="mb-3"
              />
              <ScrollArea className="h-[300px]">
                <div className="space-y-1 pr-4">
                  {filteredStaff.length === 0 ? (
                    <div className="p-3 text-center text-sm text-muted-foreground">
                      {assigneeSearchQuery
                        ? 'No staff match your search'
                        : 'Type to search for staff'}
                    </div>
                  ) : (
                    filteredStaff.map((staff) => (
                      <label
                        key={staff.id}
                        className="flex items-center gap-2 cursor-pointer p-2 hover:bg-muted rounded"
                      >
                        <Checkbox
                          checked={assigneeFilters.includes(staff.id)}
                          onCheckedChange={() => toggleAssigneeFilter(staff.id)}
                        />
                        <div className="flex flex-col items-start flex-1">
                          <div className="font-medium text-sm">
                            {staff.first_name} {staff.last_name}
                          </div>
                          {staff.role && (
                            <div className="text-xs text-muted-foreground">
                              {staff.role}
                            </div>
                          )}
                        </div>
                      </label>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[300px]">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('title')}
                  className="h-8 -ml-3"
                >
                  Title
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('status')}
                  className="h-8 -ml-3"
                >
                  Status
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('priority')}
                  className="h-8 -ml-3"
                >
                  Priority
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Assignee</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('due_date')}
                  className="h-8 -ml-3"
                >
                  Due Date
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead>Estimate</TableHead>
              <TableHead>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleSort('created_at')}
                  className="h-8 -ml-3"
                >
                  Created
                  <ArrowUpDown className="ml-2 h-4 w-4" />
                </Button>
              </TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedTasks.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  {searchTerm || activeFiltersCount > 0
                    ? 'No tasks match your filters'
                    : 'No tasks found'}
                </TableCell>
              </TableRow>
            ) : (
              sortedTasks.map((task) => {
                const assigneeInitials = task.assignee
                  ? getUserInitials(task.assignee.first_name, task.assignee.last_name)
                  : null;
                const assigneeName = task.assignee
                  ? `${task.assignee.first_name} ${task.assignee.last_name}`
                  : 'Unassigned';
                const overdue = isOverdue(task.due_date);

                return (
                  <TableRow
                    key={task.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => {
                      setSelectedTaskId(task.id);
                      setIsEditDialogOpen(true);
                    }}
                  >
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <span>{task.title}</span>
                        {task.description && (
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {task.description}
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Select
                          value={task.status}
                          onValueChange={(value) => handleStatusChange(task.id, value as TaskStatus)}
                        >
                          <SelectTrigger className="w-[140px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <Select
                          value={String(task.priority ?? 0)}
                          onValueChange={(value) => handlePriorityChange(task.id, Number(value) as TaskPriority)}
                        >
                          <SelectTrigger className="w-[130px] h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITY_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={String(option.value)}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </TableCell>
                    <TableCell>
                      {task.assignee ? (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground text-xs font-medium">
                                  {assigneeInitials}
                                </div>
                                <span className="text-sm">{assigneeName}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>{assigneeName}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      ) : (
                        <span className="text-sm text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.due_date ? (
                        <div className={cn('flex items-center gap-1 text-sm', overdue && 'text-red-600 dark:text-red-400')}>
                          <Calendar className="h-4 w-4" />
                          {formatDueDate(task.due_date)}
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {task.estimate ? (
                        <Badge variant="outline" className="text-xs">
                          {task.estimate} pts
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(task.created_at as string).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => {
                            setSelectedTaskId(task.id);
                            setIsEditDialogOpen(true);
                          }}>
                            Edit Task
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit task dialog */}
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
    </div>
  );
}
