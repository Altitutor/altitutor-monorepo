type SessionTitleInput = {
  session_type?: string | null;
  subject_year_level?: number | null;
  subject_name?: string | null;
  short_name?: string | null;
};

const MEETING_TITLES: Record<string, string> = {
  HOMEWORK_HELP: 'Homework help',
  CHECK_IN: 'Check-in',
  TRIAL_SESSION: 'Trial',
  ADMIN_MEETING: 'Meeting',
  SUBSIDY_INTERVIEW: 'Interview',
  STAFF_INTERVIEW: 'Interview',
  ADMIN_SHIFT: 'Admin',
};

export function sessionDisplayTitle(session: SessionTitleInput): string {
  const shortName = session.short_name?.trim();
  if (shortName) return shortName;
  const meeting = session.session_type ? MEETING_TITLES[session.session_type] : undefined;
  if (meeting && session.session_type !== 'CLASS') return meeting;
  const year = session.subject_year_level != null ? `Year ${session.subject_year_level} ` : '';
  const subject = session.subject_name?.trim();
  const titled = `${year}${subject ?? ''}`.trim();
  if (titled) return titled;
  return meeting ?? 'Class';
}

export function sessionTypeLabel(sessionType: string | null | undefined): string {
  if (sessionType === 'HOMEWORK_HELP') return 'Homework help';
  return sessionType ?? 'Session';
}
