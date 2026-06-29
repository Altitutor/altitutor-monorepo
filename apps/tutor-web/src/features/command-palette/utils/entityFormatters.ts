import type { Enums } from '@altitutor/shared';
import { formatResourceTypeLabel } from '@altitutor/shared';
import { getSubjectColorStyle } from '@/shared/utils';
import type { TutorCommandPaletteEntityResult } from '../types';

export interface SubjectPillStyle {
  shortName: string;
  style: { backgroundColor?: string };
  textColorClass: string;
  defaultClass: string;
}

export interface EntityDisplayText {
  title: string;
  subtitle: string | null;
  subjectPill?: SubjectPillStyle | null;
}

function buildSubjectPill(subject: {
  short_name?: string | null;
  long_name?: string | null;
  name?: string | null;
  color?: string | null;
}): SubjectPillStyle | null {
  const shortName = subject.short_name ?? subject.long_name ?? subject.name ?? '';
  if (!shortName) return null;

  const { style, textColorClass } = getSubjectColorStyle({
    color: subject.color ?? null,
  } as Parameters<typeof getSubjectColorStyle>[0]);
  const defaultClass = !subject.color
    ? 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
    : '';

  return {
    shortName,
    style: { backgroundColor: style.backgroundColor },
    textColorClass,
    defaultClass,
  };
}

export function getEntityDisplayText(result: TutorCommandPaletteEntityResult): EntityDisplayText {
  if (result.type === 'subject') {
    return {
      title: result.data.long_name || result.data.short_name || result.data.name || '',
      subtitle: result.data.curriculum || null,
    };
  }

  if (result.type === 'topic') {
    const topicCode = result.data.code || '';
    const topicName = result.data.name || '';
    return {
      title: [topicCode, topicName].filter(Boolean).join(' ').trim(),
      subtitle: null,
      subjectPill: buildSubjectPill(result.data.subject),
    };
  }

  if (result.type === 'file') {
    const fileTypeLabel = result.data.type
      ? formatResourceTypeLabel(result.data.type as Enums<'resource_type'>)
      : '';
    const title = [result.data.code, result.data.topic.name, fileTypeLabel].filter(Boolean).join(' ').trim();

    return {
      title,
      subtitle: result.data.filename,
      subjectPill: buildSubjectPill(result.data.subject),
    };
  }

  if (result.type === 'flashcards') {
    const topicCode = result.data.topic.code || '';
    const topicName = result.data.topic.name || '';
    return {
      title: ['Flashcards', topicCode, topicName].filter(Boolean).join(' · ').trim(),
      subtitle: null,
      subjectPill: buildSubjectPill(result.data.subject),
    };
  }

  if (result.type === 'class') {
    return {
      title: result.data.short_name?.trim() || result.data.long_name?.trim() || 'Class',
      subtitle: result.data.long_name?.trim() || result.data.subject_name || null,
    };
  }

  return { title: '', subtitle: null };
}
