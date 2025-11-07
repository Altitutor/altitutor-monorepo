import { 
  FileText, 
  BookOpen, 
  ClipboardCheck, 
  Video, 
  GraduationCap, 
  Sparkles, 
  FileCheck, 
  Zap,
  File
} from 'lucide-react';
import type { Enums } from '@altitutor/shared';

export function getFileTypeIcon(type: Enums<'resource_type'>) {
  switch (type) {
    case 'NOTES':
      return FileText;
    case 'PRACTICE_QUESTIONS':
      return ClipboardCheck;
    case 'TEST':
      return FileCheck;
    case 'VIDEO':
      return Video;
    case 'EXAM':
      return GraduationCap;
    case 'REVISION_SHEET':
      return BookOpen;
    case 'CHEAT_SHEET':
      return Sparkles;
    case 'FLASHCARDS':
      return Zap;
    default:
      return File;
  }
}

export function getFileTypeLabel(type: Enums<'resource_type'>): string {
  switch (type) {
    case 'NOTES':
      return 'Notes';
    case 'PRACTICE_QUESTIONS':
      return 'Practice Questions';
    case 'TEST':
      return 'Test';
    case 'VIDEO':
      return 'Video';
    case 'EXAM':
      return 'Exam';
    case 'REVISION_SHEET':
      return 'Revision Sheet';
    case 'CHEAT_SHEET':
      return 'Cheat Sheet';
    case 'FLASHCARDS':
      return 'Flashcards';
    default:
      return 'File';
  }
}

