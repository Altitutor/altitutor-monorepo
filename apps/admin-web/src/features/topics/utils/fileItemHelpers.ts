/**
 * Utility functions for managing file items
 * Separated from UI components for reusability and testability
 */

export interface FileItem {
  id: string;
  file: File;
  index: number;
  solutionOfId: string | null; // ID of the file this is a solution for
}

/**
 * Create file items from files with solution relationships
 */
export function createFileItems(
  files: File[],
  solutionMap: Map<string, string | null>,
  existingMaxIndex = 0
): FileItem[] {
  // Sort files by name initially
  const sortedFiles = [...files].sort((a, b) => a.name.localeCompare(b.name));

  // Create file items with initial order and solution relationships
  const timestamp = Date.now();
  return sortedFiles.map((file, index) => {
    const solutionForName = solutionMap.get(file.name);
    const solutionForItem = solutionForName
      ? sortedFiles.find((f) => f.name === solutionForName)
      : null;

    const fileId = `${file.name}-${file.size}-${timestamp}-${index}`;
    const solutionForId = solutionForItem
      ? `${solutionForItem.name}-${solutionForItem.size}-${timestamp}-${sortedFiles.indexOf(solutionForItem)}`
      : null;

    return {
      id: fileId,
      file,
      index: existingMaxIndex + index + 1,
      solutionOfId: solutionForId,
    };
  });
}

/**
 * Re-index file items after removal or reordering
 */
export function reindexFileItems(items: FileItem[]): FileItem[] {
  return items.map((item, idx) => ({
    ...item,
    index: idx + 1,
  }));
}

/**
 * Validate file size
 */
export function validateFileSize(file: File, maxSizeBytes: number): boolean {
  return file.size <= maxSizeBytes;
}

/**
 * Validate multiple files and return oversized ones
 */
export function validateFileSizes(files: File[], maxSizeBytes: number): File[] {
  return files.filter((file) => !validateFileSize(file, maxSizeBytes));
}
