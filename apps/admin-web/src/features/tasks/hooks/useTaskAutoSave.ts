import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { TaskFormData, TaskStatus } from '../types';

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
  const estimate = form.watch('estimate');
  const dueDate = form.watch('dueDate');

  // Debounce used only as a trigger; we save the current value when the effect runs (same as description).
  const debouncedTitleTrigger = useDebounce(title, 1000);
  const debouncedDescriptionTrigger = useDebounce(description, 1000);

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

    if (estimate !== lastSavedValuesRef.current.estimate) {
      updates.estimate = estimate;
      lastSavedValuesRef.current.estimate = estimate;
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
  }, [status, priority, assignedTo, issueId, estimate, dueDate, task, isInitialized, isUpdatingFromServer, onSave]);

  // Initialize lastSavedValues when task loads
  useEffect(() => {
    if (task && isInitialized) {
      lastSavedValuesRef.current = {
        title,
        descriptionJson: JSON.stringify(description),
        status,
        priority,
        assignedTo,
        issueId,
        estimate,
        dueDate,
      };
    }
  }, [task, isInitialized, title, description, status, priority, assignedTo, issueId, estimate, dueDate]);
}
