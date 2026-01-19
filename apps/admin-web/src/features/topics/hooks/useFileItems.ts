import { useState, useCallback, useMemo } from 'react';
import type { FileItem } from '../utils/fileItemHelpers';
import { createFileItems, reindexFileItems } from '../utils/fileItemHelpers';
import { parseFileRelationships } from '../utils/fileRelationships';

export interface UseFileItemsReturn {
  fileItems: FileItem[];
  regularFiles: FileItem[];
  solutionFiles: FileItem[];
  addFiles: (files: File[]) => void;
  removeFile: (fileId: string) => void;
  updateFileSolution: (fileId: string, solutionOfId: string | null) => void;
  reorderFiles: (activeId: string, overId: string) => void;
  clearFiles: () => void;
}

/**
 * Hook for managing file items state and operations
 * Separates file management logic from UI component
 */
export function useFileItems(): UseFileItemsReturn {
  const [fileItems, setFileItems] = useState<FileItem[]>([]);

  const regularFiles = useMemo(
    () => fileItems.filter((f) => !f.solutionOfId),
    [fileItems]
  );

  const solutionFiles = useMemo(
    () => fileItems.filter((f) => f.solutionOfId),
    [fileItems]
  );

  const addFiles = useCallback((files: File[]) => {
    if (files.length === 0) return;

    // Parse file relationships
    const solutionMap = parseFileRelationships(files);

    // Get max index from existing files
    const maxIndex = fileItems.length > 0 ? Math.max(...fileItems.map((f) => f.index)) : 0;

    // Create new file items
    const newFileItems = createFileItems(files, solutionMap, maxIndex);

    // Append to existing files
    setFileItems((prev) => [...prev, ...newFileItems]);
  }, [fileItems]);

  const removeFile = useCallback((fileId: string) => {
    setFileItems((prev) => {
      const filtered = prev.filter((f) => f.id !== fileId);
      return reindexFileItems(filtered);
    });
  }, []);

  const updateFileSolution = useCallback((fileId: string, solutionOfId: string | null) => {
    setFileItems((prev) =>
      prev.map((item) =>
        item.id === fileId ? { ...item, solutionOfId } : item
      )
    );
  }, []);

  const reorderFiles = useCallback((activeId: string, overId: string) => {
    setFileItems((prev) => {
      const activeFile = prev.find((f) => f.id === activeId);
      const overFile = prev.find((f) => f.id === overId);

      if (!activeFile || !overFile) return prev;

      const activeIsSolution = !!activeFile.solutionOfId;
      const overIsSolution = !!overFile.solutionOfId;

      // Only allow reordering within the same column type
      if (activeIsSolution && overIsSolution) {
        // Both are solutions - only allow if they're solutions for the same file
        if (activeFile.solutionOfId === overFile.solutionOfId) {
          const targetId = activeFile.solutionOfId;
          const solutionFilesForTarget = prev
            .filter((f) => f.solutionOfId === targetId)
            .sort((a, b) => a.index - b.index);
          const otherFiles = prev.filter((f) => f.solutionOfId !== targetId);

          const oldIndex = solutionFilesForTarget.findIndex((f) => f.id === activeId);
          const newIndex = solutionFilesForTarget.findIndex((f) => f.id === overId);

          if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
            const reordered = [...solutionFilesForTarget];
            const [removed] = reordered.splice(oldIndex, 1);
            reordered.splice(newIndex, 0, removed);
            const updated = reordered.map((item, idx) => ({
              ...item,
              index: idx + 1,
            }));
            // Merge back with other files and re-index all
            const merged = [...otherFiles, ...updated];
            return reindexFileItems(merged);
          }
        }
        return prev;
      }

      // Both are regular files - reorder
      if (!activeIsSolution && !overIsSolution) {
        const oldIndex = prev.findIndex((f) => f.id === activeId);
        const newIndex = prev.findIndex((f) => f.id === overId);

        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          const reordered = [...prev];
          const [removed] = reordered.splice(oldIndex, 1);
          reordered.splice(newIndex, 0, removed);
          return reindexFileItems(reordered);
        }
      }

      return prev;
    });
  }, []);

  const clearFiles = useCallback(() => {
    setFileItems([]);
  }, []);

  return {
    fileItems,
    regularFiles,
    solutionFiles,
    addFiles,
    removeFile,
    updateFileSolution,
    reorderFiles,
    clearFiles,
  };
}
