import { parseFileRelationships } from '../fileRelationships';

describe('parseFileRelationships', () => {
  it('should return empty map for empty files array', () => {
    const result = parseFileRelationships([]);
    expect(result.size).toBe(0);
  });

  it('should initialize all files with no solution relationship', () => {
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    expect(result.get('test1.pdf')).toBeNull();
    expect(result.get('test2.pdf')).toBeNull();
  });

  it('should detect STUDENT pattern - file2 is solution for file1', () => {
    const file1 = new File([''], 'question-student.pdf');
    const file2 = new File([''], 'question.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    // file1 has STUDENT, so file2 is the solution
    expect(result.get('question.pdf')).toBe('question-student.pdf');
    expect(result.get('question-student.pdf')).toBeNull();
  });

  it('should detect STUDENT pattern - file1 is solution for file2', () => {
    const file1 = new File([''], 'question.pdf');
    const file2 = new File([''], 'question-student.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    // file2 has STUDENT, so file1 is the solution
    expect(result.get('question.pdf')).toBe('question-student.pdf');
    expect(result.get('question-student.pdf')).toBeNull();
  });

  it('should detect SOL pattern - file1 is solution for file2', () => {
    const file1 = new File([''], 'question-sol.pdf');
    const file2 = new File([''], 'question.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    // file1 has SOL, so it's the solution for file2
    expect(result.get('question-sol.pdf')).toBe('question.pdf');
    expect(result.get('question.pdf')).toBeNull();
  });

  it('should detect ANS pattern - file1 is solution for file2', () => {
    const file1 = new File([''], 'question-ans.pdf');
    const file2 = new File([''], 'question.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    // file1 has ANS, so it's the solution for file2
    expect(result.get('question-ans.pdf')).toBe('question.pdf');
    expect(result.get('question.pdf')).toBeNull();
  });

  it('should handle files with different extensions', () => {
    const file1 = new File([''], 'question-student.docx');
    const file2 = new File([''], 'question.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    expect(result.get('question.pdf')).toBe('question-student.docx');
    expect(result.get('question-student.docx')).toBeNull();
  });

  it('should not match files that do not contain each other', () => {
    const file1 = new File([''], 'test1.pdf');
    const file2 = new File([''], 'test2.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    expect(result.get('test1.pdf')).toBeNull();
    expect(result.get('test2.pdf')).toBeNull();
  });

  it('should handle case-insensitive matching', () => {
    const file1 = new File([''], 'Question-STUDENT.pdf');
    const file2 = new File([''], 'question.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    expect(result.get('question.pdf')).toBe('Question-STUDENT.pdf');
  });

  it('should handle files with both STUDENT and SOL patterns', () => {
    const file1 = new File([''], 'question-student.pdf');
    const file2 = new File([''], 'question-sol.pdf');
    const result = parseFileRelationships([file1, file2]);
    
    // Both patterns are detected, but they don't match each other
    // (one has STUDENT, one has SOL, but they don't contain each other's base name)
    // So no relationship is established
    expect(result.get('question-sol.pdf')).toBeNull();
    expect(result.get('question-student.pdf')).toBeNull();
  });
});
