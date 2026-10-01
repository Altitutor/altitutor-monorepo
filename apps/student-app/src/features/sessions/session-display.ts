type SessionTitleInput = {
  session_type?: string | null;
  subject_year_level?: number | null;
  subject_name?: string | null;
  short_name?: string | null;
};

export function sessionDisplayTitle(session: SessionTitleInput): string {
  if (session.session_type === 'HOMEWORK_HELP') return 'Homework help';
  if (session.short_name) return session.short_name;
  const year = session.subject_year_level != null ? `Year ${session.subject_year_level} ` : '';
  return `${year}${session.subject_name ?? 'Class'}`;
}

export function sessionTypeLabel(sessionType: string | null | undefined): string {
  if (sessionType === 'HOMEWORK_HELP') return 'Homework help';
  return sessionType ?? 'Session';
}
