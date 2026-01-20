import { useState, useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import type { FileItem } from '../utils/fileItemHelpers';

export interface UseFileDragAndDropParams {
  fileItems: FileItem[];
  updateFileSolution: (fileId: string, solutionOfId: string | null) => void;
  reorderFiles: (activeId: string, overId: string) => void;
}

export interface UseFileDragAndDropReturn {
  activeId: string | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Hook for managing drag-and-drop logic for file items
 * Separates drag-and-drop logic from UI component
 */
export function useFileDragAndDrop({
  fileItems,
  updateFileSolution,
  reorderFiles,
}: UseFileDragAndDropParams): UseFileDragAndDropReturn {
  const [activeId, setActiveId] = useState<string | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Check if dropping in solutions column
      if (overId.startsWith('solutions-column-')) {
        const fileItem = fileItems.find((f) => f.id === activeId);
        if (fileItem) {
          // Extract the target file ID from the droppable ID
          const targetFileId = overId.replace('solutions-column-', '');
          // Make sure the target file exists and is not the same as the dragged file
          const targetFile = fileItems.find((f) => f.id === targetFileId);
          if (targetFile && targetFile.id !== activeId) {
            updateFileSolution(activeId, targetFileId);
          }
        }
        return;
      }

      // Check if dropping back to files column
      if (overId === 'files-column') {
        updateFileSolution(activeId, null);
        return;
      }

      // Reorder files
      reorderFiles(activeId, overId);
    },
    [fileItems, updateFileSolution, reorderFiles]
  );

  return {
    activeId,
    handleDragStart,
    handleDragEnd,
  };
}
