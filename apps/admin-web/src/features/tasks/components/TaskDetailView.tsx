'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  DialogTitle,
  DialogDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  type JSONContent,
  type RichTextEditorRef,
  Button,
  Form,
} from '@altitutor/ui';
import { X, ArrowLeft, Loader2 } from 'lucide-react';
import { ExpandButton } from '@/shared/components/expandable-dialog';
import { AutoSaveStatus } from '@/shared/components/AutoSaveStatus';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import { useCurrentStaff } from '@/shared/hooks';
import type { Tables } from '@altitutor/shared';
import type { TaskFormData, TaskStatus, TaskUpdate } from '../types';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';
import { EntityResizablePanels } from '@/shared/components/EntityResizablePanels';
import { useTaskAutoSave } from '../hooks/useTaskAutoSave';
import { useTaskActions } from '../hooks/useTaskActions';
import { ActionsMenu } from '@/shared/components/ActionsMenu';
import { SaveAsTemplateDialog } from '@/features/rich-text-templates/components/SaveAsTemplateDialog';
import { EditIssueDialog } from '@/features/issues/components/EditIssueDialog';
import { EditProjectDialog } from '@/features/projects/components/EditProjectDialog';
import type { UseFormReturn, Resolver } from 'react-hook-form';

const VALID_TASK_STATUSES: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'in_review', 'done'];

function normalizeTaskStatus(status: string | null | undefined): TaskStatus {
  if (status && VALID_TASK_STATUSES.includes(status as TaskStatus)) {
    return status as TaskStatus;
  }
  return 'backlog';
}

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
      if (val === null || val === undefined || val === '' || val === 0 || val === 'none') {
        return null;
      }
      const num = typeof val === 'string' ? Number(val) : (typeof val === 'number' ? val : null);
      return (num !== null && typeof num === 'number' && !isNaN(num) && num >= 1 && num <= 5) ? num : null;
    },
    z.union([z.number().min(1).max(5), z.null()]).default(null)
  ),
  dueDate: z.union([z.string(), z.null()]).default(null),
});

interface AutoSaveManagerProps {
  form: UseFormReturn<TaskFormData>;
  taskId: string;
  task: Tables<'tasks'> | undefined;
  isInitialized: boolean;
  isLoading: boolean;
  onSave: (updates: Partial<TaskFormData>) => Promise<void>;
}

function AutoSaveManager({ form, taskId, task, isInitialized, isLoading, onSave }: AutoSaveManagerProps) {
  useTaskAutoSave({
    form,
    taskId,
    task,
    isInitialized,
    isUpdatingFromServer: isLoading,
    onSave,
  });
  return null;
}

export interface TaskDetailViewProps {
  taskId: string;
  enabled?: boolean;
  onClose: () => void;
  onTaskUpdated?: () => void;
  issue?: { id: string; name: string | null } | null;
  project?: { id: string; name: string | null } | null;
  variant: 'dialog' | 'page';
  expanded?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
}

export function TaskDetailView({
  taskId,
  enabled = true,
  onClose,
  onTaskUpdated,
  issue,
  project,
  variant,
  expanded = false,
  onExpandedChange,
}: TaskDetailViewProps) {
  const router = useRouter();
  const { data: task, isLoading } = useTask(taskId, enabled);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const { data: currentStaff } = useCurrentStaff();
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<{ id: string; name: string | null } | null>(issue ?? null);
  const [selectedProject, setSelectedProject] = useState<{ id: string; name: string | null } | null>(project ?? null);
  const lastResetTaskIdRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [openIssueId, setOpenIssueId] = useState<string | null>(null);
  const [openProjectId, setOpenProjectId] = useState<string | null>(null);
  const [, setFormKey] = useState(0);
  const descriptionRef = useRef<RichTextEditorRef>(null);

  const { data: notesData } = useNotes('tasks', taskId, enabled);
  type NoteWithStaff = Tables<'notes'> & {
    staff?: Tables<'staff'> | null;
  };
  const notes = (notesData || []) as NoteWithStaff[];

  const form = useForm<TaskFormData, unknown, TaskFormData>({
    resolver: zodResolver(formSchema) as Resolver<TaskFormData>,
    defaultValues: {
      title: '',
      description: null,
      status: 'backlog',
      priority: 0,
      assignedTo: null,
      issueId: null,
      projectId: null,
      estimate: null,
      dueDate: null,
    },
  });

  useEffect(() => {
    if (task && enabled && !isLoading && task.id !== lastResetTaskIdRef.current) {
      if (task.assignee) {
        setSelectedAssignee({
          id: task.assignee.id,
          first_name: task.assignee.first_name,
          last_name: task.assignee.last_name,
        } as Tables<'staff'>);
      } else {
        setSelectedAssignee(null);
      }

      const resetData: TaskFormData = {
        title: task.title,
        description: (task.description as unknown as JSONContent) || null,
        status: normalizeTaskStatus(task.status),
        priority: task.priority !== null && task.priority !== undefined ? task.priority : 0,
        assignedTo: task.assigned_to || null,
        issueId: task.issue_id || issue?.id || null,
        projectId: task.project_id || project?.id || null,
        estimate: task.estimate !== null && task.estimate !== undefined ? task.estimate : null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      };

      form.reset(resetData);
      setSelectedIssue(
        task.issue
          ? { id: task.issue.id, name: task.issue.name }
          : issue?.id
            ? { id: issue.id, name: issue.name }
            : null
      );
      setSelectedProject(
        task.project
          ? { id: task.project.id, name: task.project.name }
          : project?.id
            ? { id: project.id, name: project.name }
            : null
      );
      setFormKey(prev => prev + 1);
      lastResetTaskIdRef.current = task.id;
      setIsInitialized(true);
    }
  }, [task, enabled, isLoading, form, issue, project]);

  useEffect(() => {
    if (!enabled) {
      lastResetTaskIdRef.current = null;
      setIsInitialized(false);
      setSelectedAssignee(null);
      setSelectedIssue(issue ?? null);
      setSelectedProject(project ?? null);
    }
  }, [enabled, issue, project]);

  const handleAutoSave = useCallback(async (updates: Partial<TaskFormData>) => {
    if (!taskId) return;

    try {
      const formattedUpdates: Record<string, unknown> = { ...updates };
      if (updates.assignedTo !== undefined) {
        formattedUpdates.assigned_to = updates.assignedTo;
        delete formattedUpdates.assignedTo;
      }
      if (updates.dueDate !== undefined) {
        formattedUpdates.due_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
        delete formattedUpdates.dueDate;
      }
      if (updates.issueId !== undefined) {
        formattedUpdates.issue_id = updates.issueId;
        delete formattedUpdates.issueId;
      }
      if (updates.projectId !== undefined) {
        formattedUpdates.project_id = updates.projectId;
        delete formattedUpdates.projectId;
      }
      const rawEstimate = updates.estimate;
      if (
        rawEstimate !== undefined &&
        (rawEstimate === null || rawEstimate === 0 || (typeof rawEstimate === 'number' && (rawEstimate < 1 || rawEstimate > 5)))
      ) {
        formattedUpdates.estimate = null;
      }
      if (updates.status === 'done') {
        formattedUpdates.completed_by = currentStaff?.id ?? null;
      }

      await updateTask.mutateAsync({
        id: taskId,
        updates: formattedUpdates as TaskUpdate,
      });
    } catch (error) {
      console.error('Failed to auto-save task:', error);
    }
  }, [taskId, updateTask, currentStaff?.id]);

  const handleDelete = async () => {
    try {
      await deleteTask.mutateAsync(taskId);
      onClose();
      onTaskUpdated?.();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  const taskActions = useTaskActions({
    taskId,
    onOpenInPage:
      variant === 'dialog'
        ? () => {
            router.push(`/tasks/${taskId}`);
            onClose();
          }
        : undefined,
  });

  const title = isLoading ? 'Loading...' : variant === 'page' ? 'Task Details' : 'Edit Task';

  return (
    <>
      <div className="h-full min-h-0 flex flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b bg-card px-6 py-4">
          <div className="flex items-center justify-between gap-4 w-full">
            <div className="flex items-center gap-3 flex-1">
              <Button
                variant={variant === 'page' ? 'ghost' : 'outline'}
                size="icon"
                onClick={onClose}
                className={variant === 'page' ? 'shrink-0 border' : 'shrink-0'}
              >
                {variant === 'page' ? (
                  <ArrowLeft className="h-4 w-4" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </Button>
              <div className="flex-1">
                {variant === 'dialog' ? (
                  <>
                    <DialogTitle>{title}</DialogTitle>
                    <DialogDescription className="sr-only">
                      Edit the details, description, and properties of this task.
                    </DialogDescription>
                  </>
                ) : (
                  <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <AutoSaveStatus isPending={updateTask.isPending} isError={updateTask.isError} />
              {variant === 'dialog' && onExpandedChange && (
                <ExpandButton expanded={expanded} onToggle={() => onExpandedChange(!expanded)} />
              )}
              <ActionsMenu
                type="task"
                entityId={taskId}
                onOpenInPage={taskActions.onOpenInPage}
                onDelete={() => setIsDeleteDialogOpen(true)}
                richTextTemplateConfig={{
                  getEditor: () => descriptionRef.current?.getEditor() ?? null,
                  getCurrentContent: () => form.getValues('description') ?? null,
                  onSaveAsTemplateClick: () => setIsSaveDialogOpen(true),
                }}
              />
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-6">Loading task data...</div>
          ) : !task ? (
            <div className="p-6">Task not found</div>
          ) : (
            <div className="h-full min-h-0 flex overflow-hidden">
              <Form {...form}>
                <form className="h-full flex-1 flex min-h-0 overflow-hidden">
                  <AutoSaveManager
                    form={form}
                    taskId={taskId}
                    task={task}
                    isInitialized={isInitialized}
                    isLoading={isLoading}
                    onSave={handleAutoSave}
                  />
                  <EntityResizablePanels
                    id={`task-${taskId}-panels`}
                    main={(
                      <TaskContentPanel
                        form={form}
                        taskId={taskId}
                        notes={notes}
                        isOpen={enabled}
                        selectedAssignee={selectedAssignee}
                        onAssigneeChange={setSelectedAssignee}
                        taskStatus={task.status as TaskStatus}
                        enabled={enabled}
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
                        onOpenIssue={(id) => setOpenIssueId(id)}
                        onOpenProject={(id) => setOpenProjectId(id)}
                        taskStatus={task.status as TaskStatus}
                        enabled={enabled}
                      />
                    )}
                  />
                </form>
              </Form>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the task
              and all associated data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteTask.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteTask.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <SaveAsTemplateDialog
        isOpen={isSaveDialogOpen}
        onClose={() => setIsSaveDialogOpen(false)}
        initialContent={form.getValues('description') ?? null}
        onSuccess={() => setIsSaveDialogOpen(false)}
      />

      {openIssueId && (
        <EditIssueDialog
          isOpen={!!openIssueId}
          onClose={() => setOpenIssueId(null)}
          issueId={openIssueId}
        />
      )}
      {openProjectId && (
        <EditProjectDialog
          isOpen={!!openProjectId}
          onClose={() => setOpenProjectId(null)}
          projectId={openProjectId}
        />
      )}
    </>
  );
}
