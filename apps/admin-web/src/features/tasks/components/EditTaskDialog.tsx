'use client';

import { useState, useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { TaskStatus } from '../types';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.number().min(0).max(4),
  assignedTo: z.string().uuid().optional().nullable(),
  estimate: z.number().min(1).max(5).optional().nullable(),
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
  const { data: task, isLoading } = useTask(taskId || '', !!taskId && isOpen);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const lastResetTaskIdRef = useRef<string | null>(null);

  // Fetch notes for task
  const { data: notesData } = useNotes('tasks', taskId || '', !!taskId && isOpen);
  const notes = (notesData || []) as unknown[];

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
    if (task && isOpen && !isLoading && task.id !== lastResetTaskIdRef.current) {
      const resetData = {
        title: task.title,
        description: task.description || '',
        status: task.status as TaskStatus,
        priority: (task.priority ?? 0) as number,
        assignedTo: task.assigned_to || null,
        estimate: task.estimate || null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      };
      form.reset(resetData, { keepDefaultValues: false });
      lastResetTaskIdRef.current = task.id;
      setIsDeleting(false);

      // Set selected assignee if task has one
      if (task.assignee) {
        setSelectedAssignee({
          id: task.assignee.id,
          first_name: task.assignee.first_name,
          last_name: task.assignee.last_name,
          role: null,
          status: null,
          email: null,
          phone_number: null,
          created_at: null,
          updated_at: null,
        });
      } else {
        setSelectedAssignee(null);
      }
    }
  }, [task?.id, isOpen, isLoading, form, task]);

  // Reset the lastResetTaskIdRef when modal closes
  useEffect(() => {
    if (!isOpen) {
      lastResetTaskIdRef.current = null;
      setSelectedAssignee(null);
    }
  }, [isOpen]);

  // Safeguard: Restore status if it becomes empty unexpectedly
  useEffect(() => {
    if (task && isOpen && !isLoading) {
      const currentStatus = form.getValues('status');
      if (!currentStatus) {
        form.setValue('status', task.status as TaskStatus, { shouldDirty: false });
      }
    }
  }, [task?.status, isOpen, isLoading, form, task]);

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
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
          <div className="p-4">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <DialogTitle>Edit Task</DialogTitle>
          </DialogHeader>
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
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex min-h-0">
                <TaskPropertiesPanel
                  form={form}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  taskStatus={task.status as TaskStatus}
                  enabled={isOpen}
                />
                <TaskContentPanel
                  form={form}
                  taskId={taskId}
                  notes={notes}
                  isOpen={isOpen}
                />
              </form>
            </Form>
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
                <Button
                  type="submit"
                  onClick={form.handleSubmit(onSubmit)}
                  disabled={updateTask.isPending || deleteTask.isPending}
                >
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
