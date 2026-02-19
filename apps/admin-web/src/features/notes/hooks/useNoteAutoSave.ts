import { useEffect, useRef } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useDebounce } from '@/shared/hooks';
import { z } from 'zod';
import type { JSONContent } from '@altitutor/ui';

const formSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  content: z.any(),
  folder_id: z.string().nullable().optional(),
});

type FormData = {
  title: string;
  content: JSONContent | string;
  folder_id?: string | null;
};

interface UseNoteAutoSaveOptions {
  form: UseFormReturn<FormData>;
  noteId: string;
  note: { id: string } | undefined;
  isInitialized: boolean;
  isUpdatingFromServer: boolean | (() => boolean);
  onSave: (updates: { title?: string; content?: JSONContent | string; folder_id?: string | null }) => void;
}

/**
 * Hook to handle auto-save for note fields (title, content, folder_id).
 * Debounces changes and only saves when values actually change.
 */
export function useNoteAutoSave({
  form,
  noteId,
  note,
  isInitialized,
  isUpdatingFromServer,
  onSave,
}: UseNoteAutoSaveOptions): void {
  const lastSavedValuesRef = useRef<{ title?: string; contentJson?: string; folder_id?: string | null }>({});

  // Watch form values
  const title = form.watch('title');
  const content = form.watch('content');
  const folderId = form.watch('folder_id');

  // Debounce title and content (folder_id saves immediately)
  const debouncedTitle = useDebounce(title, 1000);
  const debouncedContentTrigger = useDebounce(content, 1000);

  // Auto-save for title
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function' 
      ? isUpdatingFromServer() 
      : isUpdatingFromServer;
    if (!isInitialized || isUpdating) return;
    if (note && debouncedTitle && debouncedTitle !== lastSavedValuesRef.current.title) {
      lastSavedValuesRef.current.title = debouncedTitle;
      onSave({ title: debouncedTitle });
    }
  }, [debouncedTitle, note, isInitialized, isUpdatingFromServer, onSave]);

  // Auto-save for content
  // Use debouncedContentTrigger as trigger (fires after debounce), but save current content value
  // This ensures we save the latest value, not a stale debounced value
  useEffect(() => {
    const isUpdating = typeof isUpdatingFromServer === 'function' 
      ? isUpdatingFromServer() 
      : isUpdatingFromServer;
    
    if (!isInitialized || isUpdating) return;
    
    const contentJson = JSON.stringify(content);
    // Compare current content (not debounced) against last saved to ensure we save the latest value
    if (note && content !== undefined && contentJson !== lastSavedValuesRef.current.contentJson) {
      lastSavedValuesRef.current.contentJson = contentJson;
      onSave({ content });
    }
  }, [debouncedContentTrigger, content, note, isInitialized, isUpdatingFromServer, onSave]);

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

  // Initialize lastSavedValues when note loads
  useEffect(() => {
    if (note && isInitialized) {
      lastSavedValuesRef.current = {
        title: title,
        contentJson: JSON.stringify(content),
        folder_id: folderId,
      };
    }
  }, [note, isInitialized, title, content, folderId]);
}
