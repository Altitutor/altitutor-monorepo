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
 * Debounces changes and only saves when values actually change.
 */
export function useTaskAutoSave({
  form,
  taskId,
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

  // Watch form values
  const title = form.watch('title');
  const description = form.watch('description');
  const status = form.watch('status');
  const priority = form.watch('priority');
  const assignedTo = form.watch('assignedTo');
  const issueId = form.watch('issueId');
  const projectId = form.watch('projectId');
  const estimate = form.watch('estimate');
  const dueDate = form.watch('dueDate');

  // Debounce used only as a trigger; we save the current value when the effect runs (same as description).
  const debouncedTitleTrigger = useDebounce(title, 1000);
  const debouncedDescriptionTrigger = useDebounce(description, 1000);

  // Sync lastSavedValuesRef when the dialog opens or entity changes (baseline from server).
  // Must run first so property effects see the baseline and don't save on open.
  // Use useEffect (not useLayoutEffect) so this runs after the parent's useEffect that calls form.reset().
  useEffect(() => {
    if (task && isInitialized) {
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
  }, [task, isInitialized, form]);

  // Auto-save for title (same pattern as description: effect runs on every change, saves current value)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (task && title !== undefined && title !== '' && title !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = title;
      onSave({ title });
    }
  }, [debouncedTitleTrigger, title, task, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description (trigger + current value so it saves on every change)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    
    const descriptionJson = JSON.stringify(description);
    if (task && description !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description });
    }
  }, [debouncedDescriptionTrigger, description, task, isInitialized, isUpdatingFromServer, onSave]);

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
