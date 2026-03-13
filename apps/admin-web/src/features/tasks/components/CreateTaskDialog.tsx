'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  type JSONContent,
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { X } from 'lucide-react';
import { useCreateTask } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { TaskFormData, TaskStatus } from '../types';
import type { SubmitHandler } from 'react-hook-form';
import { useCurrentStaff, useDialogHotkeys } from '@/shared/hooks';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';
import type { Resolver } from 'react-hook-form';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.union([z.record(z.unknown()), z.string(), z.null()]).optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.number().min(0).max(4),
  assignedTo: z.union([z.string().uuid(), z.null()]).default(null),
  issueId: z.union([z.string().uuid(), z.null()]).default(null),
  projectId: z.union([z.string().uuid(), z.null()]).default(null),
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

interface CreateTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onTaskCreated?: () => void;
  defaultStatus?: TaskStatus;
  defaultValues?: Partial<TaskFormData>;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
}

export function CreateTaskDialog({
  isOpen,
  onClose,
  onTaskCreated,
  defaultStatus,
  defaultValues,
  issue,
  project,
}: CreateTaskDialogProps) {
  const createTask = useCreateTask();
  const { data: currentStaff } = useCurrentStaff();
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<{ id: string; name: string | null } | null>(issue ?? null);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string | null } | null>(project ?? null);
  const [createdTaskId, setCreatedTaskId] = useState<string | null>(null);

  // Fetch notes for created task
  const { data: notesData } = useNotes('tasks', createdTaskId || '', !!createdTaskId);
  type NoteWithStaff = Tables<'notes'> & {
    staff?: Tables<'staff'> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<TaskFormData, unknown, TaskFormData>({
    resolver: zodResolver(formSchema) as Resolver<TaskFormData>,
    defaultValues: {
      title: '',
      description: null,
      status: defaultStatus || defaultValues?.status || 'todo',
      priority: defaultValues?.priority ?? 0,
      assignedTo: defaultValues?.assignedTo ?? currentStaff?.id ?? null,
      issueId: defaultValues?.issueId || issue?.id || null,
      projectId: defaultValues?.projectId || project?.id || null,
      estimate: defaultValues?.estimate || null,
      dueDate: defaultValues?.dueDate || null,
    },
  });

  // Reset form when modal opens/closes or defaultStatus changes
  useEffect(() => {
    if (isOpen) {
      const resolvedAssignedTo = defaultValues?.assignedTo ?? currentStaff?.id ?? null;

      form.reset({
        title: '',
        description: null,
        status: defaultStatus || defaultValues?.status || 'todo',
        priority: defaultValues?.priority ?? 0,
        assignedTo: resolvedAssignedTo,
        issueId: defaultValues?.issueId || issue?.id || null,
        projectId: defaultValues?.projectId || project?.id || null,
        estimate: defaultValues?.estimate || null,
        dueDate: defaultValues?.dueDate || null,
      });
      setSelectedAssignee(
        resolvedAssignedTo && currentStaff && resolvedAssignedTo === currentStaff.id
          ? currentStaff
          : null
      );
      setSelectedIssue(issue ?? null);
      setSelectedProject(project ?? null);
      setCreatedTaskId(null);
    }
  }, [isOpen, defaultStatus, defaultValues, form, issue, project, currentStaff]);

  const onSubmit = useCallback(async (data: TaskFormData): Promise<void> => {
    try {
      await createTask.mutateAsync({
        title: data.title,
        description: (data.description as JSONContent | null) ?? null,
        status: data.status,
        priority: data.priority,
        assigned_to: data.assignedTo || null,
        issue_id: data.projectId ? null : (data.issueId || null),
        project_id: data.issueId ? null : (data.projectId || null),
        estimate: data.estimate || null,
        due_date: data.dueDate ? new Date(data.dueDate as string).toISOString() : null,
        created_by: currentStaff?.id ?? null,
      });

      onTaskCreated?.();
      handleClose();
    } catch (error) {
      // Error handling is done in the mutation
      console.error('Failed to create task:', error);
    }
  }, [createTask, currentStaff, onTaskCreated]);

  const handleClose = () => {
    setCreatedTaskId(null);
    form.reset();
    onClose();
  };

  const handlePrimaryAction = useCallback(() => {
    if (createTask.isPending) return;
    void form.handleSubmit(onSubmit as SubmitHandler<TaskFormData>)();
  }, [createTask.isPending, form, onSubmit]);

  useDialogHotkeys({
    isOpen,
    onPrimaryAction: handlePrimaryAction,
    isActionDisabled: createTask.isPending,
  });

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
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
              <form onSubmit={form.handleSubmit(onSubmit as SubmitHandler<TaskFormData>)} className="flex-1 flex min-h-0">
                <TaskContentPanel
                  form={form}
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
                <TaskPropertiesPanel
                  form={form}
                  selectedAssignee={selectedAssignee}
                  onAssigneeChange={setSelectedAssignee}
                  selectedIssue={selectedIssue}
                  selectedProject={selectedProject}
                  onLinkChange={(link) => {
                    if (!link) {
                      setSelectedIssue(null);
                      setSelectedProject(null);
                      form.setValue('issueId', null, { shouldDirty: true });
                      form.setValue('projectId', null, { shouldDirty: true });
                      return;
                    }

                    if (link.type === 'issue') {
                      setSelectedIssue({ id: link.id, name: link.name });
                      setSelectedProject(null);
                      form.setValue('issueId', link.id, { shouldDirty: true });
                      form.setValue('projectId', null, { shouldDirty: true });
                    } else {
                      setSelectedProject({ id: link.id, name: link.name });
                      setSelectedIssue(null);
                      form.setValue('projectId', link.id, { shouldDirty: true });
                      form.setValue('issueId', null, { shouldDirty: true });
                    }
                  }}
                  taskStatus={defaultStatus}
                  enabled={isOpen}
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
                onClick={form.handleSubmit(onSubmit as SubmitHandler<TaskFormData>)}
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
