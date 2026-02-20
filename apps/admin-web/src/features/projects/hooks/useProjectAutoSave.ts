import { useEffect, useLayoutEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { ProjectFormData, ProjectPriority, ProjectStatus } from '../types';

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

  const name = form.watch('name');
  const description = form.watch('description');
  const status = form.watch('status');
  const priority = form.watch('priority');
  const projectLeadId = form.watch('projectLeadId');
  const startDate = form.watch('startDate');
  const targetDate = form.watch('targetDate');

  const debouncedNameTrigger = useDebounce(name, 1000);
  const debouncedDescriptionTrigger = useDebounce(description, 1000);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && name !== undefined && name !== '' && name !== lastSavedValuesRef.current.name) {
      lastSavedValuesRef.current.name = name;
      onSave({ name });
    }
  }, [debouncedNameTrigger, name, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    const descriptionJson = JSON.stringify(description);
    if (project && description !== undefined && descriptionJson !== lastSavedValuesRef.current.descriptionJson) {
      lastSavedValuesRef.current.descriptionJson = descriptionJson;
      onSave({ description });
    }
  }, [debouncedDescriptionTrigger, description, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && status !== lastSavedValuesRef.current.status) {
      lastSavedValuesRef.current.status = status;
      onSave({ status });
    }
  }, [status, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && priority !== lastSavedValuesRef.current.priority) {
      lastSavedValuesRef.current.priority = priority;
      onSave({ priority });
    }
  }, [priority, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && projectLeadId !== lastSavedValuesRef.current.projectLeadId) {
      lastSavedValuesRef.current.projectLeadId = projectLeadId;
      onSave({ projectLeadId });
    }
  }, [projectLeadId, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && startDate !== lastSavedValuesRef.current.startDate) {
      lastSavedValuesRef.current.startDate = startDate;
      onSave({ startDate });
    }
  }, [startDate, project, isInitialized, isUpdatingFromServer, onSave]);

  useEffect(() => {
    if (!isInitialized || isUpdatingFromServer) return;
    if (project && targetDate !== lastSavedValuesRef.current.targetDate) {
      lastSavedValuesRef.current.targetDate = targetDate;
      onSave({ targetDate });
    }
  }, [targetDate, project, isInitialized, isUpdatingFromServer, onSave]);

  // Sync lastSavedValuesRef in layout effect so it runs before field effects.
  // This prevents auto-save from firing on first open (treating initial load as a "change").
  useLayoutEffect(() => {
    if (project && isInitialized) {
      lastSavedValuesRef.current = {
        name,
        descriptionJson: JSON.stringify(description),
        status,
        priority,
        projectLeadId,
        startDate,
        targetDate,
      };
    }
  }, [project, isInitialized, name, description, status, priority, projectLeadId, startDate, targetDate]);
}
