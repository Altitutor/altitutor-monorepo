'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Separator } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables, Database } from '@altitutor/shared';
import type { TaskStatus, TaskPriority } from '../types';
import { TaskActivityTab } from '@/features/activity/components/tabs/TaskActivityTab';
import { TaskNotes } from './TaskNotes';
import { useNotes } from '@/shared/hooks/useNotes';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.number().min(0).max(4),
  assignedTo: z.string().uuid().optional().nullable(),
  estimate: z.number().positive().optional().nullable(),
  dueDate: z.string().optional().nullable(),
});

type FormData = z.infer<typeof formSchema>;

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onTaskUpdated?: () => void;
}

export function EditTaskDialog({ isOpen, onClose, taskId, onTaskUpdated }: EditTaskDialogProps) {
  const { data: task, isLoading } = useTask(taskId || '', !!taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [isDeleting, setIsDeleting] = useState(false);
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const descriptionRef = useRef<HTMLDivElement>(null);

  // Fetch notes for task
  const { data: notesData } = useNotes('tasks', taskId || '', !!taskId && isOpen);
  const notes = (notesData || []) as any[];

  // Search staff - default to ADMINSTAFF, then all when typing
  const { data: adminStaff = [] } = useQuery({
    queryKey: ['staff', 'admin', 'tasks', 'edit'],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_staff_admin', {
        p_search: undefined,
        p_statuses: ['ACTIVE'],
        p_include_relationships: false,
        p_limit: 100,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { staff: unknown[]; total: number };
      return (rpcData.staff || []).filter((s: any) => s.role === 'ADMINSTAFF').map((s: any) => ({
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
    },
    enabled: isOpen && assigneeSearchQuery.trim().length === 0,
    staleTime: 1000 * 60 * 5,
  });

  // Search all staff when typing
  const { data: allStaffResults, isLoading: isSearchingStaff } = useQuery({
    queryKey: ['staff', 'search', 'tasks', 'edit', assigneeSearchQuery.trim()],
    queryFn: async () => {
      const supabase = getSupabaseClient() as SupabaseClient<Database>;
      const trimmed = assigneeSearchQuery.trim();
      
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
      if (!rpcResult) return [];

      const rpcData = rpcResult as { staff: unknown[]; total: number };
      return (rpcData.staff || []).map((s: any) => ({
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
    },
    enabled: isOpen && assigneeSearchQuery.trim().length > 0,
    staleTime: 1000 * 30,
  });

  const staffList = useMemo(() => {
    if (assigneeSearchQuery.trim().length > 0) {
      return allStaffResults || [];
    }
    return adminStaff;
  }, [adminStaff, allStaffResults, assigneeSearchQuery]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: '',
      description: '',
      status: 'backlog',
      priority: 0,
      assignedTo: null,
      estimate: null,
      dueDate: null,
    },
  });

  // Reset form when task data loads
  useEffect(() => {
    if (task && isOpen) {
      form.reset({
        title: task.title,
        description: task.description || '',
        status: task.status as TaskStatus,
        priority: (task.priority ?? 0) as TaskPriority,
        assignedTo: task.assigned_to || null,
        estimate: task.estimate || null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      });
      setIsDeleting(false);
      
      // Set contentEditable divs
      if (titleRef.current) {
        titleRef.current.textContent = task.title;
      }
      if (descriptionRef.current) {
        descriptionRef.current.textContent = task.description || '';
      }
      
      // Set selected assignee if task has one
      if (task.assigned_to && task.assignee) {
        const foundStaff = staffList.find((s) => s.id === task.assignee!.id);
        if (foundStaff) {
          setSelectedAssignee(foundStaff);
        } else {
          setSelectedAssignee(null);
        }
      } else {
        setSelectedAssignee(null);
      }
      
      // Reset search query when modal opens
      setAssigneeSearchQuery('');
      setIsAssigneePopoverOpen(false);
    }
  }, [task, form, isOpen, staffList]);

  // Sync contentEditable with form
  useEffect(() => {
    if (titleRef.current && task && titleRef.current.textContent !== form.watch('title')) {
      titleRef.current.textContent = form.watch('title') || '';
    }
  }, [form.watch('title'), task]);

  useEffect(() => {
    if (descriptionRef.current && task && descriptionRef.current.textContent !== form.watch('description')) {
      descriptionRef.current.textContent = form.watch('description') || '';
    }
  }, [form.watch('description'), task]);

  // Sync selectedAssignee with form field
  useEffect(() => {
    if (selectedAssignee) {
      form.setValue('assignedTo', selectedAssignee.id);
    } else {
      form.setValue('assignedTo', null);
    }
  }, [selectedAssignee, form]);

  // Update selectedAssignee when staffList loads and we have a task assignee
  useEffect(() => {
    if (task?.assigned_to && task.assignee && staffList.length > 0 && !selectedAssignee) {
      const foundStaff = staffList.find((s) => s.id === task.assignee!.id);
      if (foundStaff) {
        setSelectedAssignee(foundStaff);
      }
    }
  }, [task, staffList, selectedAssignee]);

  const onSubmit = async (data: FormData) => {
    if (!taskId) return;

    try {
      await updateTask.mutateAsync({
        id: taskId,
        updates: {
          title: data.title,
          description: data.description || null,
          status: data.status,
          priority: data.priority,
          assigned_to: data.assignedTo || null,
          estimate: data.estimate || null,
          due_date: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
        },
      });
      onTaskUpdated?.();
    } catch (error) {
      console.error('Failed to update task:', error);
    }
  };

  const handleDelete = async () => {
    if (!taskId || !isDeleting) return;

    try {
      await deleteTask.mutateAsync(taskId);
      onClose();
      onTaskUpdated?.();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  if (!taskId || !isOpen) return null;

  if (isLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
          <div className="p-4">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
          <div className="p-4">Task not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>Edit Task</DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            {/* Left Column - Properties */}
            <div className="w-80 border-r flex-shrink-0 overflow-y-auto p-6 space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="backlog">Backlog</SelectItem>
                            <SelectItem value="todo">Todo</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="in_review">In Review</SelectItem>
                            <SelectItem value="done">Done</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="priority"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Priority</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(Number(value))}
                          value={String(field.value)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">No priority</SelectItem>
                            <SelectItem value="1">Urgent</SelectItem>
                            <SelectItem value="2">High</SelectItem>
                            <SelectItem value="3">Medium</SelectItem>
                            <SelectItem value="4">Low</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="assignedTo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Assignee</FormLabel>
                        <Popover open={isAssigneePopoverOpen} onOpenChange={setIsAssigneePopoverOpen}>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className="w-full justify-start"
                                onClick={(e) => {
                                  e.preventDefault();
                                  setIsAssigneePopoverOpen(true);
                                }}
                              >
                                {selectedAssignee
                                  ? `${selectedAssignee.first_name} ${selectedAssignee.last_name}`
                                  : 'Unassigned'}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="p-0 w-[400px]" align="start">
                            <div className="p-3">
                              <input
                                type="text"
                                placeholder="Search staff..."
                                value={assigneeSearchQuery}
                                onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                                className="w-full px-3 py-2 text-sm border rounded-md mb-3"
                              />
                              <ScrollArea className="h-[300px]">
                                <div className="space-y-1 pr-4">
                                  <Button
                                    variant="ghost"
                                    className="w-full justify-start h-auto p-3"
                                    onClick={() => {
                                      setSelectedAssignee(null);
                                      setIsAssigneePopoverOpen(false);
                                      setAssigneeSearchQuery('');
                                    }}
                                  >
                                    <div className="flex items-center gap-2 w-full">
                                      {!selectedAssignee && <Check className="h-4 w-4" />}
                                      <span className={!selectedAssignee ? 'font-medium' : ''}>
                                        Unassigned
                                      </span>
                                    </div>
                                  </Button>
                                  {isSearchingStaff ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                      Searching...
                                    </div>
                                  ) : staffList.length === 0 ? (
                                    <div className="p-3 text-center text-sm text-muted-foreground">
                                      {assigneeSearchQuery
                                        ? 'No staff match your search'
                                        : 'No staff found'}
                                    </div>
                                  ) : (
                                    staffList.map((staff) => (
                                      <Button
                                        key={staff.id}
                                        variant="ghost"
                                        className="w-full justify-start h-auto p-3"
                                        onClick={() => {
                                          setSelectedAssignee(staff);
                                          setIsAssigneePopoverOpen(false);
                                          setAssigneeSearchQuery('');
                                        }}
                                      >
                                        <div className="flex items-center gap-2 w-full">
                                          {selectedAssignee?.id === staff.id && (
                                            <Check className="h-4 w-4" />
                                          )}
                                          <div className="flex flex-col items-start flex-1">
                                            <div
                                              className={
                                                selectedAssignee?.id === staff.id ? 'font-medium' : ''
                                              }
                                            >
                                              {staff.first_name} {staff.last_name}
                                            </div>
                                            {staff.role && (
                                              <div className="text-xs text-muted-foreground">
                                                {staff.role}
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </Button>
                                    ))
                                  )}
                                </div>
                              </ScrollArea>
                            </div>
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="estimate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Estimate (points)</FormLabel>
                        <FormControl>
                          <input
                            type="number"
                            placeholder="e.g., 5"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              const value = e.target.value;
                              field.onChange(value === '' ? null : Number(value));
                            }}
                            className="w-full px-3 py-2 text-sm border rounded-md"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dueDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Due Date</FormLabel>
                        <FormControl>
                          <input
                            type="date"
                            {...field}
                            value={field.value || ''}
                            onChange={(e) => {
                              field.onChange(e.target.value || null);
                            }}
                            className="w-full px-3 py-2 text-sm border rounded-md"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </div>

            {/* Right Column - Title, Description, Activity, Notes */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  {/* Title - Document Style */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div
                              ref={titleRef}
                              contentEditable
                              onBlur={(e) => {
                                const text = e.currentTarget.textContent || '';
                                field.onChange(text);
                                form.setValue('title', text);
                              }}
                              onInput={(e) => {
                                const text = e.currentTarget.textContent || '';
                                form.setValue('title', text, { shouldValidate: true });
                              }}
                              data-placeholder="Task title"
                              className="text-2xl font-semibold outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[40px] empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                              suppressContentEditableWarning
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Description - Document Style */}
                  <div className="space-y-2">
                    <FormField
                      control={form.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <div
                              ref={descriptionRef}
                              contentEditable
                              onBlur={(e) => {
                                const text = e.currentTarget.textContent || '';
                                field.onChange(text);
                                form.setValue('description', text);
                              }}
                              onInput={(e) => {
                                const text = e.currentTarget.textContent || '';
                                form.setValue('description', text);
                              }}
                              data-placeholder="Add description..."
                              className="text-sm text-foreground outline-none focus:outline-none focus:ring-0 border-none p-0 min-h-[100px] whitespace-pre-wrap break-words leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-muted-foreground"
                              suppressContentEditableWarning
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Activity Section */}
                  <Separator />
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Activity</h3>
                    <TaskActivityTab taskId={taskId} isOpen={isOpen} />
                  </div>

                  {/* Notes Section */}
                  <Separator />
                  <TaskNotes
                    taskId={taskId}
                    notes={notes}
                    onNoteAdded={() => {
                      // Notes will auto-refresh via query invalidation
                    }}
                  />
                </form>
              </Form>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <div className="flex items-center justify-between w-full">
            {isDeleting ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confirm delete?</span>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleDelete}
                  disabled={deleteTask.isPending}
                >
                  {deleteTask.isPending ? 'Deleting...' : 'Yes, Delete'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDeleting(false)}
                  disabled={deleteTask.isPending}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleting(true)}
                disabled={deleteTask.isPending || updateTask.isPending}
              >
                Delete
              </Button>
            )}
            {!isDeleting && (
              <div className="flex gap-2 ml-auto">
                <Button type="button" variant="outline" onClick={onClose}>
                  Cancel
                </Button>
                <Button type="submit" onClick={form.handleSubmit(onSubmit)} disabled={updateTask.isPending || deleteTask.isPending}>
                  {updateTask.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
