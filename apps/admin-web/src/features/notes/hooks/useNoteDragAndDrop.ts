import { useState, useCallback } from 'react';
import {
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core';
import type { FolderTreeItem } from '../types';

export interface UseNoteDragAndDropParams {
  updateNoteFolder: (noteId: string, folderId: string | null) => Promise<void>;
  updateFolderParent: (folderId: string, parentId: string | null) => Promise<void>;
  folderTree: FolderTreeItem[] | undefined;
}

export interface UseNoteDragAndDropReturn {
  activeId: string | null;
  activeType: 'note' | 'folder' | null;
  handleDragStart: (event: DragStartEvent) => void;
  handleDragEnd: (event: DragEndEvent) => void;
}

/**
 * Check if a folder is a descendant of another folder
 */
function isDescendant(
  folderId: string,
  potentialAncestorId: string,
  folderTree: FolderTreeItem[]
): boolean {
  const findFolder = (id: string, tree: FolderTreeItem[]): FolderTreeItem | null => {
    for (const folder of tree) {
      if (folder.id === id) return folder;
      const found = findFolder(id, folder.children);
      if (found) return found;
    }
    return null;
  };

  const ancestor = findFolder(potentialAncestorId, folderTree);
  if (!ancestor) return false;

  const checkDescendants = (folder: FolderTreeItem): boolean => {
    if (folder.id === folderId) return true;
    return folder.children.some((child) => checkDescendants(child));
  };

  return checkDescendants(ancestor);
}

/**
 * Hook for managing drag-and-drop logic for notes and folders
 * Separates drag-and-drop logic from UI component
 */
export function useNoteDragAndDrop({
  updateNoteFolder,
  updateFolderParent,
  folderTree = [],
}: UseNoteDragAndDropParams): UseNoteDragAndDropReturn {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'note' | 'folder' | null>(null);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const id = event.active.id as string;
    setActiveId(id);
    
    // Determine type from the active data
    const activeData = event.active.data.current;
    if (activeData?.type === 'folder') {
      setActiveType('folder');
    } else {
      setActiveType('note');
    }
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      const activeIdValue = active.id as string;
      const activeData = active.data.current;
      const isFolder = activeData?.type === 'folder';

      setActiveId(null);
      setActiveType(null);

      if (!over) return;

      const overId = over.id as string;

      // Handle folder dragging
      if (isFolder) {
        const draggedFolderId = activeIdValue.replace('folder-', '');

        // Prevent dropping folder into itself
        if (overId === activeIdValue) {
          return;
        }

        // Check if dropping on another folder
        if (overId.startsWith('folder-')) {
          const targetFolderId = overId.replace('folder-', '');

          // Prevent dropping folder into its own descendant
          if (isDescendant(targetFolderId, draggedFolderId, folderTree)) {
            return;
          }

          await updateFolderParent(draggedFolderId, targetFolderId);
          return;
        }

        // Check if dropping on "No Folder" area (move to root)
        if (overId === 'no-folder') {
          await updateFolderParent(draggedFolderId, null);
          return;
        }

        return;
      }

      // Handle note dragging (existing logic)
      const noteId = activeIdValue;

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
    [updateNoteFolder, updateFolderParent, folderTree]
  );

  return {
    activeId,
    activeType,
    handleDragStart,
    handleDragEnd,
  };
}
