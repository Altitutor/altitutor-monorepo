import { formatClassName } from '@/shared/utils';
import { formatShortDateWithDay } from './formatDate';
import type { Tables } from '@altitutor/shared';

type ClassWithSubject = {
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
};

type ClassWithSubjectAndDate = ClassWithSubject & {
  startDate: Date | null;
};

/**
 * Format classes list for variable replacement: "- ClassName" per line
 */
export function formatClassesList(
  classes: ClassWithSubject[],
  emptyMessage: string = 'No classes enrolled'
): string {
  if (classes.length === 0) return emptyMessage;
  return classes
    .map(({ class: cls, subject }) => {
      const className = formatClassName(cls, subject);
      return `- ${className}`;
    })
    .join('\n');
}

/**
 * Format classes with start dates for variable replacement
 * Uses formatShortDateWithDay for dates (e.g. "Wed 11th Feb")
 */
export function formatClassesWithStartDatesList(
  classesWithDates: ClassWithSubjectAndDate[],
  emptyMessage: string = 'No classes enrolled'
): string {
  if (classesWithDates.length === 0) return emptyMessage;
  return classesWithDates
    .map(({ class: cls, subject, startDate }) => {
      const className = formatClassName(cls, subject);
      if (startDate) {
        const formattedDate = formatShortDateWithDay(startDate);
        return `- ${className} starting on ${formattedDate}`;
      }
      return `- ${className}`;
    })
    .join('\n');
}
