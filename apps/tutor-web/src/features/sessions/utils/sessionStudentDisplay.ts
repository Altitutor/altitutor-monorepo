export type SessionStudentDisplayKind = 'absent' | 'extra' | 'attending';

export function sessionStudentDisplayKind(student: {
  planned_absence?: boolean | null;
  is_extra?: boolean | null;
}): SessionStudentDisplayKind {
  if (student.planned_absence) return 'absent';
  if (student.is_extra) return 'extra';
  return 'attending';
}

export function sessionStudentDisplaySuffix(kind: SessionStudentDisplayKind): string {
  if (kind === 'absent') return ' (absent)';
  if (kind === 'extra') return ' (extra)';
  return '';
}

export function sessionStudentBadgeClassName(kind: SessionStudentDisplayKind): string {
  if (kind === 'absent') {
    return 'bg-red-100 text-red-600 line-through dark:bg-red-900/30 dark:text-red-400';
  }
  if (kind === 'extra') {
    return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
  }
  return 'bg-muted text-muted-foreground';
}
