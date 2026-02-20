import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { IssueFormData, IssueStatus } from '../types';

interface UseIssueAutoSaveOptions {
  form: UseFormReturn<IssueFormData>;
  issueId: string;
  issue: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean;
  onSave: (updates: Partial<IssueFormData>) => Promise<void>;
}

/**
 * Hook to handle auto-save for issue fields (name, description, status).
 * Debounces changes and only saves when values actually change.
 */
export function useIssueAutoSave({
  form,
  issueId: _issueId,
  issue,
  isInitialized,
  isUpdatingFromServer,
  onSave,
}: UseIssueAutoSaveOptions): void {
  const lastSavedValuesRef = useRef<{ name?: string; descriptionJson?: string; status?: IssueStatus; dueDate?: string | null }>({});

  // Watch form values
  const name = form.watch('name');
  const description = form.watch('description');
  const status = form.watch('status');
  const dueDate = form.watch('dueDate');

  // Debounce used only as a trigger; we save the current value when the effect runs (same as description).
  const debouncedNameTrigger = useDebounce(name, 1000);
  const debouncedDescriptionTrigger = useDebounce(description, 1000);

  // Auto-save for name (same pattern as description: effect runs on every change, saves current value)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (issue && name !== undefined && name !== '' && name !== lastSavedValuesRef.current.name) {
      lastSavedValuesRef.current.name = name;
      onSave({ name });
    }
  }, [debouncedNameTrigger, name, issue, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description (trigger + current value so it saves on every change)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    
    const descriptionJson = JSON.stringify(description);
    if (issue && description !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description });
    }
  }, [debouncedDescriptionTrigger, description, issue, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for status (immediate, no debounce)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (issue && status !== lastSavedValuesRef.current.status) {
      lastSavedValuesRef.current.status = status;
      onSave({ status });
    }
  }, [status, issue, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for due date (immediate, no debounce)
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (issue && dueDate !== lastSavedValuesRef.current.dueDate) {
      lastSavedValuesRef.current.dueDate = dueDate;
      onSave({ dueDate });
    }
  }, [dueDate, issue, isInitialized, isUpdatingFromServer, onSave]);

  // Initialize lastSavedValues when issue loads
  useEffect(() => {
    if (issue && isInitialized) {
      lastSavedValuesRef.current = {
        name: name,
        descriptionJson: JSON.stringify(description),
        status: status,
        dueDate: dueDate,
      };
    }
  }, [issue, isInitialized, name, description, status, dueDate]);
}
