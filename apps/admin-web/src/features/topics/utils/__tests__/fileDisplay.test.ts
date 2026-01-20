import {
  groupFilesByType,
  getNonSolutionFiles,
  findLinkedSolution,
  type TopicFileWithFile,
} from '../fileDisplay';
import type { Tables, Enums } from '@altitutor/shared';

describe('fileDisplay utilities', () => {
  const createMockFile = (id: string): Tables<'files'> => ({
    id,
    filename: `file-${id}.pdf`,
    mimetype: 'application/pdf',
    size_bytes: 1000,
    storage_path: `path/to/file-${id}.pdf`,
    storage_provider: 'supabase',
    bucket: 'resources',
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    deleted_at: null,
  });

  const createMockTopicFile = (
    id: string,
    type: Enums<'resource_type'>,
    index: number,
    isSolutions = false,
    isSolutionsOfId: string | null = null
  ): TopicFileWithFile => ({
    id,
    topic_id: 'topic-1',
    file_id: `file-${id}`,
    type,
    index,
    code: `CODE-${id}`,
    is_solutions: isSolutions,
    is_solutions_of_id: isSolutionsOfId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    created_by: null,
    file: createMockFile(`file-${id}`),
  });

  describe('groupFilesByType', () => {
    it('should group files by resource type', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1),
        createMockTopicFile('2', 'NOTES', 2),
        createMockTopicFile('3', 'PRACTICE_QUESTIONS', 1),
        createMockTopicFile('4', 'TEST', 1),
      ];

      const result = groupFilesByType(files);

      expect(result.NOTES).toHaveLength(2);
      expect(result.PRACTICE_QUESTIONS).toHaveLength(1);
      expect(result.TEST).toHaveLength(1);
      expect(result.VIDEO).toHaveLength(0);
      expect(result.EXAM).toHaveLength(0);
      expect(result.FLASHCARDS).toHaveLength(0);
      expect(result.REVISION_SHEET).toHaveLength(0);
      expect(result.CHEAT_SHEET).toHaveLength(0);
    });

    it('should sort files within each type by index', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 3),
        createMockTopicFile('2', 'NOTES', 1),
        createMockTopicFile('3', 'NOTES', 2),
      ];

      const result = groupFilesByType(files);

      expect(result.NOTES[0].index).toBe(1);
      expect(result.NOTES[1].index).toBe(2);
      expect(result.NOTES[2].index).toBe(3);
    });

    it('should handle empty array', () => {
      const result = groupFilesByType([]);

      expect(result.NOTES).toHaveLength(0);
      expect(result.PRACTICE_QUESTIONS).toHaveLength(0);
      expect(result.TEST).toHaveLength(0);
    });

    it('should include all resource types in result', () => {
      const files: TopicFileWithFile[] = [];
      const result = groupFilesByType(files);

      expect(result).toHaveProperty('NOTES');
      expect(result).toHaveProperty('PRACTICE_QUESTIONS');
      expect(result).toHaveProperty('TEST');
      expect(result).toHaveProperty('VIDEO');
      expect(result).toHaveProperty('EXAM');
      expect(result).toHaveProperty('FLASHCARDS');
      expect(result).toHaveProperty('REVISION_SHEET');
      expect(result).toHaveProperty('CHEAT_SHEET');
    });
  });

  describe('getNonSolutionFiles', () => {
    it('should filter out solution files', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 2, true),
        createMockTopicFile('3', 'TEST', 1, false),
        createMockTopicFile('4', 'TEST', 2, true),
      ];

      const result = getNonSolutionFiles(files);

      expect(result).toHaveLength(2);
      expect(result[0].is_solutions).toBe(false);
      expect(result[1].is_solutions).toBe(false);
      expect(result.every((f) => !f.is_solutions)).toBe(true);
    });

    it('should return all files when none are solutions', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 2, false),
      ];

      const result = getNonSolutionFiles(files);

      expect(result).toHaveLength(2);
    });

    it('should return empty array when all files are solutions', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, true),
        createMockTopicFile('2', 'NOTES', 2, true),
      ];

      const result = getNonSolutionFiles(files);

      expect(result).toHaveLength(0);
    });

    it('should handle empty array', () => {
      const result = getNonSolutionFiles([]);
      expect(result).toHaveLength(0);
    });
  });

  describe('findLinkedSolution', () => {
    it('should find linked solution file', () => {
      const targetFileId = 'file-1';
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 1, true, targetFileId),
        createMockTopicFile('3', 'TEST', 1, false),
      ];

      const result = findLinkedSolution(targetFileId, files);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('2');
      expect(result?.is_solutions).toBe(true);
      expect(result?.is_solutions_of_id).toBe(targetFileId);
    });

    it('should return null when no solution is linked', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 1, false),
      ];

      const result = findLinkedSolution('file-1', files);

      expect(result).toBeNull();
    });

    it('should return null when solution exists but is not linked to target', () => {
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 1, true, 'file-999'),
      ];

      const result = findLinkedSolution('file-1', files);

      expect(result).toBeNull();
    });

    it('should handle empty array', () => {
      const result = findLinkedSolution('file-1', []);
      expect(result).toBeNull();
    });

    it('should find solution even when multiple solutions exist', () => {
      const targetFileId = 'file-1';
      const files: TopicFileWithFile[] = [
        createMockTopicFile('1', 'NOTES', 1, false),
        createMockTopicFile('2', 'NOTES', 1, true, targetFileId),
        createMockTopicFile('3', 'NOTES', 1, true, 'file-999'),
      ];

      const result = findLinkedSolution(targetFileId, files);

      expect(result).not.toBeNull();
      expect(result?.id).toBe('2');
      expect(result?.is_solutions_of_id).toBe(targetFileId);
    });
  });
});
