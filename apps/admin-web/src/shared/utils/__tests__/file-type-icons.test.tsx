/**
 * Tests for file type icon and label utilities
 * Tests icon selection and label mapping based on resource_type
 */

import {
  getFileTypeIcon,
  getFileTypeLabel,
} from '../file-type-icons';
import {
  FileText,
  BookOpen,
  ClipboardCheck,
  Video,
  GraduationCap,
  Sparkles,
  FileCheck,
  Zap,
  File,
} from 'lucide-react';

describe('getFileTypeIcon', () => {
  it('should return FileText for NOTES', () => {
    const icon = getFileTypeIcon('NOTES');
    expect(icon).toBe(FileText);
  });

  it('should return ClipboardCheck for PRACTICE_QUESTIONS', () => {
    const icon = getFileTypeIcon('PRACTICE_QUESTIONS');
    expect(icon).toBe(ClipboardCheck);
  });

  it('should return FileCheck for TEST', () => {
    const icon = getFileTypeIcon('TEST');
    expect(icon).toBe(FileCheck);
  });

  it('should return Video for VIDEO', () => {
    const icon = getFileTypeIcon('VIDEO');
    expect(icon).toBe(Video);
  });

  it('should return GraduationCap for EXAM', () => {
    const icon = getFileTypeIcon('EXAM');
    expect(icon).toBe(GraduationCap);
  });

  it('should return BookOpen for REVISION_SHEET', () => {
    const icon = getFileTypeIcon('REVISION_SHEET');
    expect(icon).toBe(BookOpen);
  });

  it('should return Sparkles for CHEAT_SHEET', () => {
    const icon = getFileTypeIcon('CHEAT_SHEET');
    expect(icon).toBe(Sparkles);
  });

  it('should return Zap for FLASHCARDS', () => {
    const icon = getFileTypeIcon('FLASHCARDS');
    expect(icon).toBe(Zap);
  });

  it('should return File for unknown type (default)', () => {
    const icon = getFileTypeIcon('UNKNOWN_TYPE' as 'NOTES');
    expect(icon).toBe(File);
  });
});

describe('getFileTypeLabel', () => {
  it('should return "Notes" for NOTES', () => {
    expect(getFileTypeLabel('NOTES')).toBe('Notes');
  });

  it('should return "Practice Questions" for PRACTICE_QUESTIONS', () => {
    expect(getFileTypeLabel('PRACTICE_QUESTIONS')).toBe('Practice Questions');
  });

  it('should return "Test" for TEST', () => {
    expect(getFileTypeLabel('TEST')).toBe('Test');
  });

  it('should return "Video" for VIDEO', () => {
    expect(getFileTypeLabel('VIDEO')).toBe('Video');
  });

  it('should return "Exam" for EXAM', () => {
    expect(getFileTypeLabel('EXAM')).toBe('Exam');
  });

  it('should return "Revision Sheet" for REVISION_SHEET', () => {
    expect(getFileTypeLabel('REVISION_SHEET')).toBe('Revision Sheet');
  });

  it('should return "Cheat Sheet" for CHEAT_SHEET', () => {
    expect(getFileTypeLabel('CHEAT_SHEET')).toBe('Cheat Sheet');
  });

  it('should return "Flashcards" for FLASHCARDS', () => {
    expect(getFileTypeLabel('FLASHCARDS')).toBe('Flashcards');
  });

  it('should return "File" for unknown type (default)', () => {
    expect(getFileTypeLabel('UNKNOWN_TYPE' as 'NOTES')).toBe('File');
  });
});
