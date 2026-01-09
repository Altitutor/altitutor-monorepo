'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Badge } from '@altitutor/ui';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import { useStaff } from '@/features/staff/hooks/useStaffQuery';
import { getPriorityColor, getPriorityLabel, getStatusColor, getStatusLabel, formatDueDate, getUserInitials } from '../utils/taskUtils';
import type { TaskStatus, TaskPriority } from '../types';
import { Calendar } from 'lucide-react';

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

interface TaskDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onTaskUpdated?: () => void;
}

export function TaskDetailModal({ isOpen, onClose, taskId, onTaskUpdated }: TaskDetailModalProps) {
  const { data: task, isLoading } = useTask(taskId || '', !!taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: staff = [] } = useStaff();
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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
    if (task) {
      form.reset({
        title: task.title,
        description: task.description || '',
        status: task.status as TaskStatus,
        priority: (task.priority ?? 0) as TaskPriority,
        assignedTo: task.assigned_to || null,
        estimate: task.estimate || null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      });
      setIsEditing(false);
    }
  }, [task, form]);

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
      setIsEditing(false);
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
        <DialogContent>
          <div className="p-4">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent>
          <div className="p-4">Task not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  const assigneeName = task.assignee
    ? `${task.assignee.first_name} ${task.assignee.last_name}`
    : 'Unassigned';
  const creatorName = task.creator
    ? `${task.creator.first_name} ${task.creator.last_name}`
    : 'System';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Task' : 'Task Details'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Update task information' : 'View and manage task details'}
          </DialogDescription>
        </DialogHeader>

        {isEditing ? (
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="assignedTo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Assignee</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === 'none' ? null : value)}
                        value={field.value || 'none'}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Unassigned" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Unassigned</SelectItem>
                          {staff.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.first_name} {s.last_name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                        value={field.value || ''}
                        onChange={(e) => {
                          field.onChange(e.target.value || null);
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateTask.isPending}>
                  {updateTask.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold mb-2">{task.title}</h3>
              {task.description && (
                <p className="text-muted-foreground whitespace-pre-wrap">{task.description}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium mb-1">Status</div>
                <Badge className={getStatusColor(task.status as TaskStatus)}>
                  {getStatusLabel(task.status as TaskStatus)}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Priority</div>
                <Badge className={getPriorityColor((task.priority ?? 0) as TaskPriority)}>
                  {getPriorityLabel((task.priority ?? 0) as TaskPriority)}
                </Badge>
              </div>
              <div>
                <div className="text-sm font-medium mb-1">Assignee</div>
                <div className="text-sm">{assigneeName}</div>
              </div>
              {task.estimate && (
                <div>
                  <div className="text-sm font-medium mb-1">Estimate</div>
                  <Badge variant="outline">{task.estimate} pts</Badge>
                </div>
              )}
              {task.due_date && (
                <div>
                  <div className="text-sm font-medium mb-1">Due Date</div>
                  <div className="text-sm flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    {formatDueDate(task.due_date)}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t">
              <div className="text-sm text-muted-foreground">
                Created by {creatorName} on {new Date(task.created_at as string).toLocaleDateString()}
              </div>
              {task.updated_at !== task.created_at && (
                <div className="text-sm text-muted-foreground">
                  Last updated {new Date(task.updated_at as string).toLocaleDateString()}
                </div>
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setIsDeleting(true)}
                disabled={deleteTask.isPending}
              >
                {deleteTask.isPending ? 'Deleting...' : 'Delete'}
              </Button>
              {isDeleting && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Confirm delete?</span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={handleDelete}
                  >
                    Yes
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDeleting(false)}
                  >
                    No
                  </Button>
                </div>
              )}
              <Button type="button" variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
              <Button type="button" onClick={onClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

