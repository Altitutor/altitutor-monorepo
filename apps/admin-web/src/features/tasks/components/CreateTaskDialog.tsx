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
  DialogFooter,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { X } from 'lucide-react';
import { useCreateTask } from '../api/mutations';
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

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  defaultStatus?: TaskStatus;
}

export function CreateTaskDialog({
  isOpen,
  onClose,
  onTaskCreated,
  defaultStatus,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask();
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  // Fetch notes for created task
  const { data: notesData } = useNotes('tasks', createdTaskId || '', !!createdTaskId);
  type NoteWithStaff = Tables<'notes'> & {
    staff?: Tables<'staff'> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema) as any,
    defaultValues: {
      title: '',
      description: '',
      status: defaultStatus || 'todo',
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
        status: defaultStatus || 'todo',
        priority: 0,
        assignedTo: null,
        estimate: null,
        dueDate: null,
      });
      setSelectedAssignee(null);
      setCreatedTaskId(null);
    }
  }, [isOpen, defaultStatus, form]);

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

      onTaskCreated?.();
      handleClose();
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Failed to create task:', error);
    }
  };

  const handleClose = () => {
    setCreatedTaskId(null);
    form.reset();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant="outline"
                size="icon"
                onClick={handleClose}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="flex-1">
                <DialogTitle>Create Task</DialogTitle>
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
                  taskStatus={defaultStatus}
                  enabled={isOpen}
                />
                <TaskContentPanel
                  form={form as unknown as UseFormReturn<TaskFormData>}
                  taskId={createdTaskId}
                  notes={notes}
                  isOpen={isOpen}
                  showActivity={!!createdTaskId}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  taskStatus={defaultStatus}
                  enabled={isOpen}
                  autoFocusTitle={true}
                />
              </form>
            </Form>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <div className="flex items-center gap-2 w-full justify-end">
            <Button type="button" variant="outline" onClick={handleClose}>
              {createdTaskId ? 'Close' : 'Cancel'}
            </Button>
            {!createdTaskId && (
              <Button
                type="submit"
                onClick={form.handleSubmit(onSubmit as any)}
                disabled={createTask.isPending}
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
