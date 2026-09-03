import type { Tables } from '@altitutor/shared';

export function isPreviousClassEnrollment(
  unenrolledAt: string | null | undefined,
  nowMs = Date.now()
): boolean {
  if (!unenrolledAt) return false;
  return new Date(unenrolledAt).getTime() <= nowMs;
}

type GroupableStudentClass = {
  class: { id: string };
  subject?: Tables<'subjects'>;
  enrollment?: { unenrolled_at: string | null };
  isPreviousEnrollment?: boolean;
};

export function currentEnrolledClassIds(
  classes: Array<{ class: { id: string }; isPreviousEnrollment?: boolean }>
): string[] {
  return classes
    .filter((classData) => !classData.isPreviousEnrollment)
    .map((classData) => classData.class.id);
}

export type GroupedStudentClasses<T extends GroupableStudentClass = GroupableStudentClass> = {
  subjectId: string;
  subject: Tables<'subjects'> | null;
  isAssignedSubject: boolean;
  classes: T[];
};

function sortGroupClasses<T extends GroupableStudentClass>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (!!a.isPreviousEnrollment !== !!b.isPreviousEnrollment) {
      return a.isPreviousEnrollment ? 1 : -1;
    }
    const aUnenrolled = a.enrollment?.unenrolled_at ?? '';
    const bUnenrolled = b.enrollment?.unenrolled_at ?? '';
    return bUnenrolled.localeCompare(aUnenrolled);
  });
}

export function groupStudentClassesBySubject<T extends GroupableStudentClass>(
  classes: T[],
  studentSubjects: Tables<'subjects'>[],
  showPrevious: boolean
): GroupedStudentClasses<T>[] {
  const visible = showPrevious
    ? classes
    : classes.filter((classData) => !classData.isPreviousEnrollment);

  const groups = new Map<string, GroupedStudentClasses<T>>();

  for (const subject of studentSubjects) {
    groups.set(subject.id, {
      subjectId: subject.id,
      subject,
      isAssignedSubject: true,
      classes: [],
    });
  }

  const unmatched: T[] = [];

  for (const classData of visible) {
    const subjectId = classData.subject?.id;
    if (subjectId && groups.has(subjectId)) {
      groups.get(subjectId)!.classes.push(classData);
      continue;
    }
    if (subjectId && classData.subject) {
      const existing = groups.get(subjectId);
      if (existing) {
        existing.classes.push(classData);
      } else {
        groups.set(subjectId, {
          subjectId,
          subject: classData.subject,
          isAssignedSubject: false,
          classes: [classData],
        });
      }
      continue;
    }
    unmatched.push(classData);
  }

  const result: GroupedStudentClasses<T>[] = [];
  for (const subject of studentSubjects) {
    const group = groups.get(subject.id);
    if (group) {
      result.push({ ...group, classes: sortGroupClasses(group.classes) });
      groups.delete(subject.id);
    }
  }
  for (const group of groups.values()) {
    result.push({ ...group, classes: sortGroupClasses(group.classes) });
  }
  if (unmatched.length > 0) {
    result.push({
      subjectId: '__no_subject__',
      subject: null,
      isAssignedSubject: false,
      classes: sortGroupClasses(unmatched),
    });
  }
  return result;
}
