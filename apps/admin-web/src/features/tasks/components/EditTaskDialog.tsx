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
import { X } from 'lucide-react';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { TaskStatus } from '../types';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';
import type { UseFormReturn } from 'react-hook-form';

type TaskFormData = {
  title: string;
  description?: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'done';
  priority: number;
  assignedTo: string | null;
  estimate: number | null;
  dueDate: string | null;
};

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.number().min(0).max(4),
  assignedTo: z.union([z.string().uuid(), z.null()]).default(null),
  estimate: z.preprocess(
    (val) => {
      // Convert falsy or invalid values to null
      if (val === null || val === undefined || val === '' || val === 0 || val === 'none') {
        return null;
      }
      // Parse string to number if needed
      const num = typeof val === 'string' ? Number(val) : (typeof val === 'number' ? val : null);
      // Return null if invalid, otherwise return the number
      return (num !== null && typeof num === 'number' && !isNaN(num) && num >= 1 && num <= 5) ? num : null;
    },
    z.union([z.number().min(1).max(5), z.null()]).default(null)
  ),
  dueDate: z.union([z.string(), z.null()]).default(null),
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
  const [, setFormKey] = useState(0); // Force re-render of form fields - setFormKey is used


  // Fetch notes for task
  const { data: notesData } = useNotes('tasks', taskId || '', !!taskId && isOpen);
  type NoteWithStaff = Tables<'notes'> & {
    staff?: Tables<'staff'> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
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

  // Reset form when task data loads - simplified like other modals
  useEffect(() => {
    if (task && isOpen && !isLoading && task.id !== lastResetTaskIdRef.current) {
      // Set selected assignee FIRST to prevent TaskAssigneeField useEffect from clearing form
      if (task.assignee) {
        setSelectedAssignee({
          id: task.assignee.id,
          first_name: task.assignee.first_name,
          last_name: task.assignee.last_name,
        } as Tables<'staff'>);
      } else {
        setSelectedAssignee(null);
      }

      const resetData: FormData = {
        title: task.title,
        description: task.description || '',
        status: task.status as TaskStatus,
        priority: task.priority !== null && task.priority !== undefined ? task.priority : 0,
        assignedTo: task.assigned_to || null,
        estimate: task.estimate !== null && task.estimate !== undefined ? task.estimate : null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      };
      
      form.reset(resetData, { keepDefaultValues: false });
      setFormKey(prev => prev + 1); // Force re-render of Select components
      lastResetTaskIdRef.current = task.id;
      setIsDeleting(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id, isOpen, isLoading]);

  // Reset the lastResetTaskIdRef when modal closes
  useEffect(() => {
    if (!isOpen) {
      lastResetTaskIdRef.current = null;
      setSelectedAssignee(null);
    }
  }, [isOpen]);


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
      onClose();
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
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DialogTitle>Edit Task</DialogTitle>
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4">Loading...</div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!task) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
          <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={onClose}
                  className="shrink-0"
                >
                  <X className="h-4 w-4" />
                </Button>
                <div className="flex-1">
                  <DialogTitle>Edit Task</DialogTitle>
                </div>
              </div>
            </div>
          </DialogHeader>
          <div className="p-4">Task not found</div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={onClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>Edit Task</DialogTitle>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit as any)} className="flex-1 flex min-h-0">
                <TaskPropertiesPanel
                  form={form as unknown as UseFormReturn<TaskFormData>}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  taskStatus={task.status as TaskStatus}
                  enabled={isOpen}
                />
                <TaskContentPanel
                  form={form as unknown as UseFormReturn<TaskFormData>}
                  taskId={taskId}
                  notes={notes}
                  isOpen={isOpen}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  taskStatus={task.status as TaskStatus}
                  enabled={isOpen}
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
                  onClick={form.handleSubmit(onSubmit as any)}
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
