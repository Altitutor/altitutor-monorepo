'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  type JSONContent,
  type RichTextEditorRef,
} from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { MoreVertical } from 'lucide-react';
import { RichTextTemplateMenuItems } from '@/features/rich-text-templates/components/RichTextTemplateMenuItems';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import { useCreateTask } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { TaskFormData, TaskStatus } from '../types';
import type { SubmitHandler } from 'react-hook-form';
import { useCurrentStaff, useDialogHotkeys } from '@/shared/hooks';
import { AdminDialogShell } from '@/shared/components';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';
import { EntityResizablePanels } from '@/shared/components/EntityResizablePanels';
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
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const descriptionRef = useRef<RichTextEditorRef>(null);

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

  const handleClose = useCallback(() => {
    setCreatedTaskId(null);
    form.reset();
    onClose();
  }, [form, onClose]);

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
  }, [createTask, currentStaff, handleClose, onTaskCreated]);

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
    <>
      <AdminDialogShell
        fillHeight
        defaultExpanded
        open={isOpen}
        onClose={handleClose}
        title="Create Task"
        contentClassName="md:max-w-4xl"
        bodyClassName="min-h-0 flex-1 overflow-hidden p-0"
        headerActions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <RichTextTemplateMenuItems
                getEditor={() => descriptionRef.current?.getEditor() ?? null}
                getCurrentContent={() => form.getValues('description') ?? null}
                onSaveAsTemplateClick={() => setIsSaveDialogOpen(true)}
              />
            </DropdownMenuContent>
          </DropdownMenu>
        }
        footer={
          <>
            <Button type="button" variant="outline" onClick={handleClose}>
              {createdTaskId ? 'Close' : 'Cancel'}
            </Button>
            {!createdTaskId && (
              <Button
                type="submit"
                form="create-task-form"
                disabled={createTask.isPending}
              >
                {createTask.isPending ? 'Creating...' : 'Create Task'}
              </Button>
            )}
          </>
        }
      >
        <Form {...form}>
          <form
            id="create-task-form"
            onSubmit={form.handleSubmit(onSubmit as SubmitHandler<TaskFormData>)}
            className="flex h-full min-h-0 flex-1"
          >
            <EntityResizablePanels
              id="create-task-panels"
              main={(
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
                  descriptionRef={descriptionRef}
                />
              )}
              sidebar={(
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
              )}
            />
          </form>
        </Form>
      </AdminDialogShell>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('description') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />
    </>
  );
}
