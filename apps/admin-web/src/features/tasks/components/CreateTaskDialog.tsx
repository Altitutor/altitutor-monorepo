'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { Input } from '@altitutor/ui';
import { Textarea } from '@altitutor/ui';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@altitutor/ui';
import { Popover, PopoverContent, PopoverTrigger } from '@altitutor/ui';
import { ScrollArea } from '@altitutor/ui';
import { Loader2, Check } from 'lucide-react';
import { useCreateTask } from '../api/mutations';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Tables, Database } from '@altitutor/shared';
import type { TaskStatus, TaskPriority } from '../types';

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

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  defaultStatus?: TaskStatus;
}

export function CreateTaskDialog({ isOpen, onClose, onTaskCreated, defaultStatus }: CreateTaskDialogProps) {
  const createTask = useCreateTask();
  const [assigneeSearchQuery, setAssigneeSearchQuery] = useState('');
  const [isAssigneePopoverOpen, setIsAssigneePopoverOpen] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);

  // Search staff - default to ADMINSTAFF, then all when typing
  const { data: adminStaff = [] } = useQuery({
    queryKey: ['staff', 'admin', 'tasks'],
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
    queryKey: ['staff', 'search', 'tasks', assigneeSearchQuery.trim()],
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
      status: defaultStatus || 'backlog',
      priority: 0,
      assignedTo: null,
      estimate: null,
      dueDate: null,
    },
  });

  // Reset form when modal opens/closes or defaultStatus changes
  useEffect(() => {
    if (isOpen) {
      form.reset({
        title: '',
        description: '',
        status: defaultStatus || 'backlog',
        priority: 0,
        assignedTo: null,
        estimate: null,
        dueDate: null,
      });
      setSelectedAssignee(null);
      setAssigneeSearchQuery('');
    }
  }, [isOpen, defaultStatus, form]);

  // Sync selectedAssignee with form field
  useEffect(() => {
    if (selectedAssignee) {
      form.setValue('assignedTo', selectedAssignee.id);
    } else {
      form.setValue('assignedTo', null);
    }
  }, [selectedAssignee, form]);

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      await createTask.mutateAsync({
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assigned_to: data.assignedTo || null,
        estimate: data.estimate || null,
        due_date: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
      });
      form.reset();
      onTaskCreated?.();
      onClose();
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Failed to create task:', error);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task to track work items.</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title *</FormLabel>
                  <FormControl>
                    <Input placeholder="Task title" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Task description"
                      {...field}
                      value={field.value || ''}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
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
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                          <Input
                            placeholder="Search staff..."
                            value={assigneeSearchQuery}
                            onChange={(e) => setAssigneeSearchQuery(e.target.value)}
                            className="mb-3"
                          />
                          <ScrollArea className="h-[300px]">
                            <div className="space-y-1 pr-4">
                              <Button
                                variant="ghost"
                                className="w-full justify-start h-auto p-3"
                                onClick={() => {
                                  setSelectedAssignee(null);
                                  setIsAssigneePopoverOpen(false);
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
                      <Input
                        type="number"
                        placeholder="e.g., 5"
                        {...field}
                        value={field.value || ''}
                        onChange={(e) => {
                          const value = e.target.value;
                          field.onChange(value === '' ? null : Number(value));
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Due Date</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      {...field}
                      value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                      onChange={(e) => {
                        field.onChange(e.target.value ? e.target.value : null);
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={createTask.isPending}>
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

