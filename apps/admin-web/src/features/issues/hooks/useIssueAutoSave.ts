import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { IssueFormData, IssueStatus } from '../types';

const VALID_ISSUE_STATUSES: IssueStatus[] = ['open', 'awaiting_response', 'resolved'];

function isValidIssueStatus(v: unknown): v is IssueStatus {
  return typeof v === 'string' && VALID_ISSUE_STATUSES.includes(v as IssueStatus);
}

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
 * Debounces name/description and only saves when values actually change.
 *
 * Important: save effects must depend only on debounced snapshots — not live `name`/`description` —
 * otherwise JSON.stringify and network saves run on every keystroke.
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

  // Watch form values (drives debounce timers only; expensive work runs off debounced snapshots below.)
  const name = form.watch('name');
  const description = form.watch('description');
  const status = form.watch('status');
  const dueDate = form.watch('dueDate');

  const debouncedName = useDebounce(name, 1000);
  const debouncedDescription = useDebounce(description, 1000);

  // Sync lastSavedValuesRef when the dialog opens or entity changes (baseline from server).
  // Must run first so property effects see the baseline and don't save on open.
  // Use useEffect (not useLayoutEffect) so this runs after the parent's useEffect that calls form.reset().
  // Depend on issue.id (not issue) so query refetches don't reset the baseline mid-edit.
  useEffect(() => {
    if (issue && isInitialized) {
      const values = form.getValues();
      lastSavedValuesRef.current = {
        name: values.name,
        descriptionJson: JSON.stringify(values.description),
        status: values.status,
        dueDate: values.dueDate,
      };
    }
  }, [issue?.id, isInitialized, form]);

  // Auto-save for name — runs when debounced name changes (not every keystroke).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    const snapshot = debouncedName;
    if (issue && snapshot !== undefined && snapshot !== '' && snapshot !== lastSavedValuesRef.current.name) {
      lastSavedValuesRef.current.name = snapshot;
      onSave({ name: snapshot });
    }
  }, [debouncedName, issue, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description — stringify/save only after idle period (debounced snapshot).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;

    const snapshot = debouncedDescription;
    const descriptionJson = JSON.stringify(snapshot);
    if (issue && snapshot !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description: snapshot });
    }
  }, [debouncedDescription, issue, isInitialized, isUpdatingFromServer, onSave]);
  // Auto-save for status (immediate, no debounce). Only save valid enum values to avoid DB constraint errors.
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (!isValidIssueStatus(status)) return;
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
}
