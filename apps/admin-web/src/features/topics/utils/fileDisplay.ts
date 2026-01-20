import type { Tables, Enums } from '@altitutor/shared';

export type TopicFileWithFile = Tables<'topics_files'> & {
  file: Tables<'files'>;
};

export interface FilesByType {
  [key: string]: TopicFileWithFile[];
}

/**
 * Groups topic files by resource type
 * Returns an object with resource types as keys and arrays of files as values
 */
export function groupFilesByType(
  topicFiles: TopicFileWithFile[]
): Record<Enums<'resource_type'>, TopicFileWithFile[]> {
  const filesByType: Record<Enums<'resource_type'>, TopicFileWithFile[]> = {
    NOTES: [],
    PRACTICE_QUESTIONS: [],
    TEST: [],
    VIDEO: [],
    EXAM: [],
    FLASHCARDS: [],
    REVISION_SHEET: [],
    CHEAT_SHEET: [],
  };

  topicFiles.forEach((file) => {
    filesByType[file.type].push(file);
  });

  // Sort each group by index
  Object.keys(filesByType).forEach((type) => {
    filesByType[type as Enums<'resource_type'>].sort(
      (a, b) => a.index - b.index
    );
  });

  return filesByType;
}

/**
 * Filters out solution files from a list of files
 * Returns only non-solution files
 */
export function getNonSolutionFiles(
  files: TopicFileWithFile[]
): TopicFileWithFile[] {
  return files.filter((f) => !f.is_solutions);
}

/**
 * Finds the linked solution file for a given topic file
 * Returns the solution file if it exists, otherwise null
 */
export function findLinkedSolution(
  topicFileId: string,
  allFiles: TopicFileWithFile[]
): TopicFileWithFile | null {
  return (
    allFiles.find(
      (f) => f.is_solutions && f.is_solutions_of_id === topicFileId
    ) || null
  );
}
