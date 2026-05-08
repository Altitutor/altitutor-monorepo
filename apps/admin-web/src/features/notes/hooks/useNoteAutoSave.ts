import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import type { NoteFormData } from '../types';

export interface UseNoteAutoSaveOptions {
  form: UseFormReturn<NoteFormData>;
  noteId: string;
  note: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean | (() => boolean);
  onSave: (updates: Partial<NoteFormData>) => void;
}

/**
 * Hook to handle auto-save for note fields (title, content, folder_id).
 * Debounces title/content and only saves when values actually change.
 *
 * Important: save effects must depend only on debounced snapshots — not live `content`/`title` —
 * otherwise JSON.stringify runs on every keystroke for large documents.
 */
export function useNoteAutoSave({
  form,
  noteId: _noteId,
  note,
  isInitialized,
  isUpdatingFromServer,
  onSave,
}: UseNoteAutoSaveOptions): void {
  const lastSavedValuesRef = useRef<{ title?: string; contentJson?: string; folder_id?: string | null; project_id?: string | null }>({});

  // Watch form values (drives debounce timers only; expensive work runs off debounced snapshots below.)
  const title = form.watch('title');
  const content = form.watch('content');
  const folderId = form.watch('folder_id');
  const projectId = form.watch('project_id');

  const debouncedTitleTrigger = useDebounce(title, 300);
  const debouncedContentTrigger = useDebounce(content, 300);

  // Auto-save for title — runs when debounced title changes (not every keystroke).
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function' 
      ? isUpdatingFromServer() 
      : isUpdatingFromServer;
    if (!isInitialized || isUpdating) return;
    const t = debouncedTitleTrigger;
    if (note && t !== undefined && t !== '' && t !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = t;
      onSave({ title: t });
    }
  }, [debouncedTitleTrigger, note, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for content — stringify/save only after idle period (debounced snapshot).
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function' 
      ? isUpdatingFromServer() 
      : isUpdatingFromServer;
    
    if (!isInitialized || isUpdating) return;
    
    const snapshot = debouncedContentTrigger;
    const contentJson = JSON.stringify(snapshot);
    if (note && snapshot !== undefined && contentJson !== lastSavedValuesRef.current.contentJson) {
      lastSavedValuesRef.current.contentJson = contentJson;
      onSave({ content: snapshot });
    }
  }, [debouncedContentTrigger, note, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for folder_id (immediate, no debounce)
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function' 
      ? isUpdatingFromServer() 
      : isUpdatingFromServer;
    if (!isInitialized || isUpdating) return;
    if (note && folderId !== lastSavedValuesRef.current.folder_id) {
      lastSavedValuesRef.current.folder_id = folderId;
      onSave({ folder_id: folderId });
    }
  }, [folderId, note, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for project_id (immediate, no debounce)
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function'
      ? isUpdatingFromServer()
      : isUpdatingFromServer;
    if (!isInitialized || isUpdating) return;
    if (note && projectId !== lastSavedValuesRef.current.project_id) {
      lastSavedValuesRef.current.project_id = projectId;
      onSave({ project_id: projectId });
    }
  }, [projectId, note, isInitialized, isUpdatingFromServer, onSave]);

  // Baseline lastSavedValues when a note is opened — not on every edit (avoids wasted work and wrong refs).
  useEffect(() => {
    if (!note?.id || !isInitialized) return;
    const values = form.getValues();
    lastSavedValuesRef.current = {
      title: values.title,
      contentJson: JSON.stringify(values.content),
      folder_id: values.folder_id ?? null,
      project_id: values.project_id ?? null,
    };
  }, [note?.id, isInitialized, form]);
}

/** Renders nothing; keeps auto-save subscriptions off the main note page/dialog body so typing does not re-render the full tree. */
export function NoteAutoSaveBridge(props: UseNoteAutoSaveOptions) {
  useNoteAutoSave(props);
  return null;
}
