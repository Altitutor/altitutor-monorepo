/**
 * Entity Formatters for Command Palette
 * 
 * Extracts display text (title/subtitle) from entity results.
 * This logic is used in multiple places and should be centralized.
 */

import type { Enums, Tables } from '@altitutor/shared';
import { getFileTypeLabel } from '@/shared/utils';
import type { CommandPaletteEntityResult } from '../types';

export interface EntityDisplayText {
  title: string;
  subtitle: string | null;
}

/**
 * Extract display text (title and subtitle) from an entity result
 */
export function getEntityDisplayText(result: CommandPaletteEntityResult): EntityDisplayText {
  if (result.type === 'student') {
    const studentData = result.data as Tables<'students'>;
    const title = [studentData.first_name, studentData.last_name]
      .filter(Boolean)
      .join(' ')
      .trim();
    
    // Fallback for students without names (e.g., some trial students)
    const finalTitle = title || `Student ${studentData.id.slice(0, 8)}`;
    return {
      title: finalTitle,
      subtitle: studentData.school || null,
    };
  }

  if (result.type === 'staff') {
    return {
      title: [result.data.first_name, result.data.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      subtitle: result.data.role || null,
    };
  }

  if (result.type === 'parent') {
    return {
      title: [result.data.first_name, result.data.last_name]
        .filter(Boolean)
        .join(' ')
        .trim(),
      subtitle: result.data.email || result.data.phone || null,
    };
  }

  if (result.type === 'class') {
    const classData = result.data as Tables<'classes'>;
    return {
      title: classData.short_name?.trim() ?? '',
      subtitle: classData.long_name?.trim() ?? null,
    };
  }

  if (result.type === 'subject') {
    return {
      title: result.data.long_name || result.data.short_name || result.data.name || '',
      subtitle: result.data.curriculum || null,
    };
  }

  if (result.type === 'task') {
    return {
      title: result.data.title || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'issue') {
    return {
      title: result.data.name || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'project') {
    return {
      title: result.data.name || '',
      subtitle: result.data.status || null,
    };
  }

  if (result.type === 'topic') {
    const subjectName =
      result.data.subject?.long_name ||
      result.data.subject?.short_name ||
      result.data.subject?.name ||
      '';
    const topicCode = result.data.code || '';
    const topicName = result.data.name || '';
    const title = [subjectName, topicCode, topicName].filter(Boolean).join(' ').trim();
    return {
      title,
      subtitle: null,
    };
  }

  if (result.type === 'file') {
    const fileData = result.data;
    const subjectName =
      fileData.subject.short_name || fileData.subject.long_name || '';
    const fileCode = fileData.code || '';
    const topicName = fileData.topic.name || '';
    const fileTypeLabel = fileData.type
      ? getFileTypeLabel(fileData.type as Enums<'resource_type'>)
      : '';
    const title = [subjectName, fileCode, topicName, fileTypeLabel]
      .filter(Boolean)
      .join(' ')
      .trim();
    return {
      title,
      subtitle: fileData.file.filename,
    };
  }

  if (result.type === 'note') {
    const noteData = result.data as Tables<'notes_documents'>;
    const title = noteData.title?.trim() || 'Untitled note';

    return {
      title,
      subtitle: null,
    };
  }

  // Fallback (should never reach here with proper typing)
  return {
    title: '',
    subtitle: null,
  };
}
