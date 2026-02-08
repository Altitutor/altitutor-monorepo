import { useState, useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';

export interface UseNoteDragAndDropParams {
  updateNoteFolder: (noteId: string, folderId: string | null) => Promise<void>;
}

export interface UseNoteDragAndDropReturn {
  activeId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Hook for managing drag-and-drop logic for notes
 * Separates drag-and-drop logic from UI component
 */
export function useNoteDragAndDrop({
  updateNoteFolder,
}: UseNoteDragAndDropParams): UseNoteDragAndDropReturn {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (!over) return;

      const noteId = active.id as string;
      const overId = over.id as string;

      // Check if dropping on a folder
      if (overId.startsWith('folder-')) {
        const folderId = overId.replace('folder-', '');
        await updateNoteFolder(noteId, folderId);
        return;
      }

      // Check if dropping on "No Folder" area
      if (overId === 'no-folder') {
        await updateNoteFolder(noteId, null);
        return;
      }
    },
    [updateNoteFolder]
  );

  return {
    activeId,
    handleDragStart,
    handleDragEnd,
  };
}
