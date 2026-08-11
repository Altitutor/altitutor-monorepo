import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../types';

const VALID_PROJECT_STATUSES: ProjectStatus[] = ['backlog', 'planned', 'in_progress', 'completed'];

function isValidProjectStatus(v: unknown): v is ProjectStatus {
  return typeof v === 'string' && VALID_PROJECT_STATUSES.includes(v as ProjectStatus);
}

interface UseProjectAutoSaveOptions {
  form: UseFormReturn<ProjectFormData>;
  projectId: string;
  project: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean;
  onSave: (updates: Partial<ProjectFormData>) => Promise<void>;
}

export function useProjectAutoSave({
  form,
  projectId: _projectId,
  project,
  isInitialized,
  isUpdatingFromServer,
  onSave,
}: UseProjectAutoSaveOptions): void {
  const lastSavedValuesRef = useRef<{
    name?: string;
    descriptionJson?: string;
    status?: ProjectStatus;
    priority?: ProjectPriority;
    projectLeadId?: string | null;
    startDate?: string | null;
    targetDate?: string | null;
  }>({});
  const baselineSyncedRef = useRef(false);

  const name = form.watch('name');
  const description = form.watch('description');
  const status = form.watch('status');
  const priority = form.watch('priority');
  const projectLeadId = form.watch('projectLeadId');
  const startDate = form.watch('startDate');
  const targetDate = form.watch('targetDate');

  const debouncedName = useDebounce(name, 1000);
  const debouncedDescription = useDebounce(description, 1000);

  // Sync lastSavedValuesRef when the dialog opens or entity changes (baseline from server).
  // Must run first so property effects see the baseline and don't save on open.
  // Use useEffect (not useLayoutEffect) so this runs after the parent's useEffect that calls form.reset().
  // Depend on project.id (not project) so query refetches don't reset the baseline mid-edit.
  useEffect(() => {
    if (project && isInitialized) {
      const values = form.getValues();
      lastSavedValuesRef.current = {
        name: values.name,
        descriptionJson: JSON.stringify(values.description),
        status: values.status,
        priority: values.priority,
        projectLeadId: values.projectLeadId,
        startDate: values.startDate,
        targetDate: values.targetDate,
      };
      baselineSyncedRef.current = true;
    } else {
      baselineSyncedRef.current = false;
    }
  }, [project?.id, isInitialized, form]);

  // Auto-save for name — runs when debounced name changes (not every keystroke).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    const snapshot = debouncedName;
    if (project && snapshot !== undefined && snapshot !== '' && snapshot !== lastSavedValuesRef.current.name) {
      lastSavedValuesRef.current.name = snapshot;
      onSave({ name: snapshot });
    }
  }, [debouncedName, project, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for description — stringify/save only after idle period (debounced snapshot).
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    const snapshot = debouncedDescription;
    const descriptionJson = JSON.stringify(snapshot);
    if (project && snapshot !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description: snapshot });
    }
  }, [debouncedDescription, project, isInitialized, isUpdatingFromServer, onSave]);
  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    if (!isValidProjectStatus(status)) return;
    if (project && status !== lastSavedValuesRef.current.status) {
      lastSavedValuesRef.current.status = status;
      onSave({ status });
    }
  }, [status, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    if (project && priority !== lastSavedValuesRef.current.priority) {
      lastSavedValuesRef.current.priority = priority;
      onSave({ priority });
    }
  }, [priority, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    if (project && projectLeadId !== lastSavedValuesRef.current.projectLeadId) {
      lastSavedValuesRef.current.projectLeadId = projectLeadId;
      onSave({ projectLeadId });
    }
  }, [projectLeadId, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    if (project && startDate !== lastSavedValuesRef.current.startDate) {
      lastSavedValuesRef.current.startDate = startDate;
      onSave({ startDate });
    }
  }, [startDate, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer || !baselineSyncedRef.current) return;
    if (project && targetDate !== lastSavedValuesRef.current.targetDate) {
      lastSavedValuesRef.current.targetDate = targetDate;
      onSave({ targetDate });
    }
  }, [targetDate, project, isInitialized, isUpdatingFromServer, onSave]);
}
