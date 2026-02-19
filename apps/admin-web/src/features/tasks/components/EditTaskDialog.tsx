'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
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
} from '@altitutor/ui';
import { Button } from '@altitutor/ui';
import { Form } from '@altitutor/ui';
import { X, Check, Loader2, CloudOff } from 'lucide-react';
import { useTask } from '../api/queries';
import { useUpdateTask, useDeleteTask } from '../api/mutations';
import type { Tables } from '@altitutor/shared';
import type { TaskStatus } from '../types';
import { useNotes } from '@/shared/hooks/useNotes';
import { TaskPropertiesPanel, TaskContentPanel } from './panels';
import { useTaskAutoSave } from '../hooks/useTaskAutoSave';
import { ActionsMenu } from '@/shared/components/ActionsMenu';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.any().optional(),
  status: z.enum(['backlog', 'todo', 'in_progress', 'in_review', 'done']),
  priority: z.number().min(0).max(4),
  assignedTo: z.union([z.string().uuid(), z.null()]).default(null),
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

type FormData = {
  title: string;
  description?: JSONContent | null;
  status: TaskStatus;
  priority: number;
  assignedTo: string | null;
  estimate: number | null;
  dueDate: string | null;
};

interface EditTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  taskId: string | null;
  onTaskUpdated?: () => void;
}

interface AutoSaveManagerProps {
  form: any;
  taskId: string;
  task: any;
  isInitialized: boolean;
  isLoading: boolean;
  onSave: (updates: Partial<FormData>) => Promise<void>;
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

export function EditTaskDialog({ isOpen, onClose, taskId, onTaskUpdated }: EditTaskDialogProps) {
  const { data: task, isLoading } = useTask(taskId || '', !!taskId && isOpen);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [selectedAssignee, setSelectedAssignee] = useState<Tables<'staff'> | null>(null);
  const lastResetTaskIdRef = useRef<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [, setFormKey] = useState(0);

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
      description: null,
      status: 'backlog',
      priority: 0,
      assignedTo: null,
      estimate: null,
      dueDate: null,
    },
  });

  useEffect(() => {
    if (task && isOpen && !isLoading && task.id !== lastResetTaskIdRef.current) {
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
        description: (task.description as unknown as JSONContent) || null,
        status: task.status as TaskStatus,
        priority: task.priority !== null && task.priority !== undefined ? task.priority : 0,
        assignedTo: task.assigned_to || null,
        estimate: task.estimate !== null && task.estimate !== undefined ? task.estimate : null,
        dueDate: task.due_date ? new Date(task.due_date).toISOString().split('T')[0] : null,
      };
      
      form.reset(resetData);
      setFormKey(prev => prev + 1);
      lastResetTaskIdRef.current = task.id;
      setIsInitialized(true);
    }
  }, [task, isOpen, isLoading, form]);

  useEffect(() => {
    if (!isOpen) {
      lastResetTaskIdRef.current = null;
      setIsInitialized(false);
      setSelectedAssignee(null);
    }
  }, [isOpen]);

  const handleAutoSave = useCallback(async (updates: Partial<FormData>) => {
    if (!taskId) return;

    try {
      const formattedUpdates: any = { ...updates };
      if (updates.assignedTo !== undefined) {
        formattedUpdates.assigned_to = updates.assignedTo;
        delete formattedUpdates.assignedTo;
      }
      if (updates.dueDate !== undefined) {
        formattedUpdates.due_date = updates.dueDate ? new Date(updates.dueDate).toISOString() : null;
        delete formattedUpdates.dueDate;
      }

      await updateTask.mutateAsync({
        id: taskId,
        updates: formattedUpdates,
      });
    } catch (error) {
      console.error('Failed to auto-save task:', error);
    }
  }, [taskId, updateTask]);

  const handleDelete = async () => {
    if (!taskId) return;
    try {
      await deleteTask.mutateAsync(taskId);
      onClose();
      onTaskUpdated?.();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  };

  if (!taskId || !isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full md:max-w-4xl h-[90vh] flex flex-col p-0 gap-0 [&>button]:hidden">
        <DialogHeader className="flex-shrink-0 px-6 py-4 border-b">
          <div className="flex items-center justify-between gap-4 w-full">
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
                <DialogTitle>{isLoading ? 'Loading...' : 'Edit Task'}</DialogTitle>
                <DialogDescription className="sr-only">
                  Edit the details, description, and properties of this task.
                </DialogDescription>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium pr-2 mr-2">
                {updateTask.isPending ? (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : updateTask.isError ? (
                  <>
                    <CloudOff className="h-3 w-3 text-destructive" />
                    <span className="text-destructive">Changes not saved</span>
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 text-emerald-500" />
                    <span>Saved</span>
                  </>
                )}
              </div>
              <ActionsMenu
                type="task"
                entityId={taskId}
                onOpenInPage={() => {
                  // Task detail page could be implemented here
                }}
                onDelete={() => setIsDeleteDialogOpen(true)}
              />
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden min-h-0">
          {isLoading ? (
            <div className="p-6">Loading task data...</div>
          ) : !task ? (
            <div className="p-6">Task not found</div>
          ) : (
            <div className="h-full flex">
              <Form {...form}>
                <form className="flex-1 flex min-h-0">
                  <AutoSaveManager
                    form={form}
                    taskId={taskId}
                    task={task}
                    isInitialized={isInitialized}
                    isLoading={isLoading}
                    onSave={handleAutoSave}
                  />
                  <TaskContentPanel
                    form={form as any}
                    taskId={taskId}
                    notes={notes}
                    isOpen={isOpen}
                    selectedAssignee={selectedAssignee}
                    onAssigneeChange={setSelectedAssignee}
                    taskStatus={task.status as TaskStatus}
                    enabled={isOpen}
                  />
                  <TaskPropertiesPanel
                    form={form as any}
                    selectedAssignee={selectedAssignee}
                    onAssigneeChange={setSelectedAssignee}
                    taskStatus={task.status as TaskStatus}
                    enabled={isOpen}
                  />
                </form>
              </Form>
            </div>
          )}
        </div>
      </DialogContent>

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
    </Dialog>
  );
}
