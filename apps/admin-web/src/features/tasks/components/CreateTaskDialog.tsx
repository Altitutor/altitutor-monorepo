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
import { Form } from '@altitutor/ui';
import { useCreateTask } from '../api/mutations';
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
  const notes = (notesData || []) as unknown[];

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
      setCreatedTaskId(null);
    }
  }, [isOpen, defaultStatus, form]);

  const onSubmit = async (data: FormData): Promise<void> => {
    try {
      const result = await createTask.mutateAsync({
        title: data.title,
        description: data.description || null,
        status: data.status,
        priority: data.priority,
        assigned_to: data.assignedTo || null,
        estimate: data.estimate || null,
        due_date: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
      });

      // Set created task ID to show activity and notes
      setCreatedTaskId(result.id);

      // Don't close immediately - let user see activity and add notes
      onTaskCreated?.();
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
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <DialogTitle>Create Task</DialogTitle>
          <DialogDescription>Create a new task to track work items.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          <div className="h-full flex">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="flex-1 flex min-h-0">
                <TaskPropertiesPanel
                  form={form}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  taskStatus={defaultStatus}
                  enabled={isOpen}
                />
                <TaskContentPanel
                  form={form}
                  taskId={createdTaskId}
                  notes={notes}
                  isOpen={isOpen}
                  showActivity={!!createdTaskId}
                />
              </form>
            </Form>
          </div>
        </div>

        <DialogFooter className="flex-shrink-0 px-6 py-4 border-t">
          <Button type="button" variant="outline" onClick={handleClose}>
            {createdTaskId ? 'Close' : 'Cancel'}
          </Button>
          {!createdTaskId && (
            <Button
              type="submit"
              onClick={form.handleSubmit(onSubmit)}
              disabled={createTask.isPending}
            >
              {createTask.isPending ? 'Creating...' : 'Create Task'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
