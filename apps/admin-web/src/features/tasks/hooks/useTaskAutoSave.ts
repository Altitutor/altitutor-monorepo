import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { JSONContent } from '@altitutor/ui';
import type { TaskStatus } from '../types';

type FormData = {
  title: string;
  description?: JSONContent | null;
  status: TaskStatus;
  priority: number;
  assignedTo: string | null;
  estimate: number | null;
  dueDate: string | null;
};

interface UseTaskAutoSaveOptions {
  form: UseFormReturn<FormData>;
  taskId: string;
  task: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean;
  onSave: (updates: Partial<FormData>) => Promise<void>;
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
    estimate?: number | null;
    dueDate?: string | null;
  }>({});

  // Watch form values
  const title = form.watch('title');
  const description = form.watch('description');
  const status = form.watch('status');
  const priority = form.watch('priority');
  const assignedTo = form.watch('assignedTo');
  const estimate = form.watch('estimate');
  const dueDate = form.watch('dueDate');

  // Debounce fields that need it
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedDescriptionTrigger = useDebounce(description, 1000);

  // Auto-save for title
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (task && debouncedTitle && debouncedTitle !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = debouncedTitle;
      onSave({ title: debouncedTitle });
    }
  }, [debouncedTitle, task, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description
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
    
    const updates: Partial<FormData> = {};
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
  }, [status, priority, assignedTo, estimate, dueDate, task, isInitialized, isUpdatingFromServer, onSave]);

  // Initialize lastSavedValues when task loads
  useEffect(() => {
    if (task && isInitialized) {
      lastSavedValuesRef.current = {
        title,
        descriptionJson: JSON.stringify(description),
        status,
        priority,
        assignedTo,
        estimate,
        dueDate,
      };
    }
  }, [task, isInitialized, title, description, status, priority, assignedTo, estimate, dueDate]);
}
