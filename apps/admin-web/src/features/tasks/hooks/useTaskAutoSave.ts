import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { TaskFormData, TaskStatus } from '../types';

/** DB allows estimate NULL or 1-5; 0 is invalid and triggers tasks_estimate_check. */
function normalizeEstimate(val: number | null | undefined): number | null {
  if (val == null || val === 0 || val < 1 || val > 5) return null;
  return val;
}

interface UseTaskAutoSaveOptions {
  form: UseFormReturn<TaskFormData>;
  taskId: string;
  task: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean;
  onSave: (updates: Partial<TaskFormData>) => Promise<void>;
}

/**
 * Hook to handle auto-save for task fields.
 * Debounces title/description and only saves when values actually change.
 *
 * Important: save effects must depend only on debounced snapshots — not live `title`/`description` —
 * otherwise JSON.stringify and network saves run on every keystroke.
 */
export function useTaskAutoSave({
  form,
  taskId: _taskId,
  task,
  isInitialized,
  isUpdatingFromServer,
  onSave,
}: UseTaskAutoSaveOptions): void {
  const lastSavedValuesRef = useRef<{
    title?: string;
    descriptionJson?: string;
    status?: TaskStatus;
    priority?: number;
    assignedTo?: string | null;
    issueId?: string | null;
    projectId?: string | null;
    estimate?: number | null;
    dueDate?: string | null;
  }>({});

  // Watch form values (drives debounce timers only; expensive work runs off debounced snapshots below.)
  const title = form.watch('title');
  const description = form.watch('description');
  const status = form.watch('status');
  const priority = form.watch('priority');
  const assignedTo = form.watch('assignedTo');
  const issueId = form.watch('issueId');
  const projectId = form.watch('projectId');
  const estimate = form.watch('estimate');
  const dueDate = form.watch('dueDate');

  const debouncedTitle = useDebounce(title, 1000);
  const debouncedDescription = useDebounce(description, 1000);

  // Sync lastSavedValuesRef when the dialog opens or entity changes (baseline from server).
  // Must run first so property effects see the baseline and don't save on open.
  // Use useEffect (not useLayoutEffect) so this runs after the parent's useEffect that calls form.reset().
  // Depend on task.id (not task) so query refetches don't reset the baseline mid-edit.
  useEffect(() => {
    if (task?.id && isInitialized) {
      const values = form.getValues();
      lastSavedValuesRef.current = {
        title: values.title,
        descriptionJson: JSON.stringify(values.description),
        status: values.status,
        priority: values.priority,
        assignedTo: values.assignedTo,
        issueId: values.issueId,
        projectId: values.projectId,
        estimate: normalizeEstimate(values.estimate),
        dueDate: values.dueDate,
      };
    }
  }, [task?.id, isInitialized, form]);

  // Auto-save for title — runs when debounced title changes (not every keystroke).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    const snapshot = debouncedTitle;
    if (task && snapshot !== undefined && snapshot !== '' && snapshot !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = snapshot;
      onSave({ title: snapshot });
    }
  }, [debouncedTitle, task, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description — stringify/save only after idle period (debounced snapshot).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;

    const snapshot = debouncedDescription;
    const descriptionJson = JSON.stringify(snapshot);
    if (task && snapshot !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description: snapshot });
    }
  }, [debouncedDescription, task, isInitialized, isUpdatingFromServer, onSave]);
  // Auto-save for other fields (immediate, no debounce for select/pills)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    
    const updates: Partial<TaskFormData> = {};
    let hasChanges = false;

    if (status !== lastSavedValuesRef.current.status) {
      updates.status = status;
      lastSavedValuesRef.current.status = status;
      hasChanges = true;
    }

    if (priority !== lastSavedValuesRef.current.priority) {
      updates.priority = priority;
      lastSavedValuesRef.current.priority = priority;
      hasChanges = true;
    }

    if (assignedTo !== lastSavedValuesRef.current.assignedTo) {
      updates.assignedTo = assignedTo;
      lastSavedValuesRef.current.assignedTo = assignedTo;
      hasChanges = true;
    }

    if (issueId !== lastSavedValuesRef.current.issueId) {
      updates.issueId = issueId;
      lastSavedValuesRef.current.issueId = issueId;
      hasChanges = true;
    }

    if (projectId !== lastSavedValuesRef.current.projectId) {
      updates.projectId = projectId;
      lastSavedValuesRef.current.projectId = projectId;
      hasChanges = true;
    }

    const validEstimate = normalizeEstimate(estimate);
    if (validEstimate !== lastSavedValuesRef.current.estimate) {
      updates.estimate = validEstimate;
      lastSavedValuesRef.current.estimate = validEstimate;
      hasChanges = true;
    }

    if (dueDate !== lastSavedValuesRef.current.dueDate) {
      updates.dueDate = dueDate;
      lastSavedValuesRef.current.dueDate = dueDate;
      hasChanges = true;
    }

    if (hasChanges && task) {
      onSave(updates);
    }
  }, [status, priority, assignedTo, issueId, projectId, estimate, dueDate, task, isInitialized, isUpdatingFromServer, onSave]);
}
