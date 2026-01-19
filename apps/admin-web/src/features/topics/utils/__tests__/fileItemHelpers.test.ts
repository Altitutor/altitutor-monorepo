import {
  createFileItems,
  reindexFileItems,
  validateFileSize,
  validateFileSizes,
  type FileItem,
} from '../fileItemHelpers';
import { parseFileRelationships } from '../fileRelationships';

describe('fileItemHelpers', () => {
  describe('createFileItems', () => {
    it('should create file items with correct structure', () => {
      const file1 = new File([''], 'test1.pdf');
      const file2 = new File([''], 'test2.pdf');
      const solutionMap = parseFileRelationships([file1, file2]);
      
      const items = createFileItems([file1, file2], solutionMap);
      
      expect(items).toHaveLength(2);
      expect(items[0]).toHaveProperty('id');
      expect(items[0]).toHaveProperty('file');
      expect(items[0]).toHaveProperty('index');
      expect(items[0]).toHaveProperty('solutionOfId');
      expect(items[0].file).toBe(file1);
      expect(items[0].index).toBe(1);
    });

    it('should assign sequential indices starting from 1', () => {
      const files = [
        new File([''], 'test1.pdf'),
        new File([''], 'test2.pdf'),
        new File([''], 'test3.pdf'),
      ];
      const solutionMap = parseFileRelationships(files);
      
      const items = createFileItems(files, solutionMap);
      
      expect(items[0].index).toBe(1);
      expect(items[1].index).toBe(2);
      expect(items[2].index).toBe(3);
    });

    it('should continue indexing from existing max index', () => {
      const files = [new File([''], 'test1.pdf')];
      const solutionMap = parseFileRelationships(files);
      
      const items = createFileItems(files, solutionMap, 5);
      
      expect(items[0].index).toBe(6);
    });

    it('should create unique IDs for each file', () => {
      const file1 = new File([''], 'test.pdf');
      const file2 = new File([''], 'test.pdf');
      const solutionMap = parseFileRelationships([file1, file2]);
      
      const items = createFileItems([file1, file2], solutionMap);
      
      expect(items[0].id).not.toBe(items[1].id);
    });

    it('should set solutionOfId based on solution map', () => {
      const file1 = new File([''], 'question-student.pdf');
      const file2 = new File([''], 'question.pdf');
      const solutionMap = parseFileRelationships([file1, file2]);
      
      const items = createFileItems([file1, file2], solutionMap);
      
      const questionFile = items.find((item) => item.file.name === 'question.pdf');
      const studentFile = items.find((item) => item.file.name === 'question-student.pdf');
      
      expect(questionFile?.solutionOfId).toBeTruthy();
      expect(studentFile?.solutionOfId).toBeNull();
    });
  });

  describe('reindexFileItems', () => {
    it('should re-index items starting from 1', () => {
      const items: FileItem[] = [
        { id: '1', file: new File([''], 'test1.pdf'), index: 10, solutionOfId: null },
        { id: '2', file: new File([''], 'test2.pdf'), index: 20, solutionOfId: null },
        { id: '3', file: new File([''], 'test3.pdf'), index: 30, solutionOfId: null },
      ];
      
      const reindexed = reindexFileItems(items);
      
      expect(reindexed[0].index).toBe(1);
      expect(reindexed[1].index).toBe(2);
      expect(reindexed[2].index).toBe(3);
    });

    it('should preserve other properties', () => {
      const items: FileItem[] = [
        { id: '1', file: new File([''], 'test1.pdf'), index: 10, solutionOfId: 'target-id' },
      ];
      
      const reindexed = reindexFileItems(items);
      
      expect(reindexed[0].id).toBe('1');
      expect(reindexed[0].file.name).toBe('test1.pdf');
      expect(reindexed[0].solutionOfId).toBe('target-id');
      expect(reindexed[0].index).toBe(1);
    });
  });

  describe('validateFileSize', () => {
    it('should return true for files within size limit', () => {
      const file = new File(['x'.repeat(1024)], 'test.pdf');
      expect(validateFileSize(file, 10 * 1024 * 1024)).toBe(true);
    });

    it('should return false for files exceeding size limit', () => {
      const file = new File(['x'.repeat(11 * 1024 * 1024)], 'test.pdf');
      expect(validateFileSize(file, 10 * 1024 * 1024)).toBe(false);
    });

    it('should return true for files exactly at size limit', () => {
      const file = new File(['x'.repeat(10 * 1024 * 1024)], 'test.pdf');
      expect(validateFileSize(file, 10 * 1024 * 1024)).toBe(true);
    });
  });

  describe('validateFileSizes', () => {
    it('should return empty array when all files are valid', () => {
      const files = [
        new File(['x'.repeat(1024)], 'test1.pdf'),
        new File(['x'.repeat(2048)], 'test2.pdf'),
      ];
      
      const oversized = validateFileSizes(files, 10 * 1024 * 1024);
      
      expect(oversized).toHaveLength(0);
    });

    it('should return only oversized files', () => {
      const files = [
        new File(['x'.repeat(1024)], 'test1.pdf'),
        new File(['x'.repeat(11 * 1024 * 1024)], 'test2.pdf'),
        new File(['x'.repeat(12 * 1024 * 1024)], 'test3.pdf'),
      ];
      
      const oversized = validateFileSizes(files, 10 * 1024 * 1024);
      
      expect(oversized).toHaveLength(2);
      expect(oversized[0].name).toBe('test2.pdf');
      expect(oversized[1].name).toBe('test3.pdf');
    });
  });
});
