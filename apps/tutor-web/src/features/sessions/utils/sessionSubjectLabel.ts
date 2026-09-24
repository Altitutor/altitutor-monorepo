export type TutorSessionSubjectFields = {
  subject_curriculum?: string | null;
  subject_year_level?: number | null;
  subject_name?: string | null;
  class_level?: string | null;
  short_name?: string | null;
  session_type?: string | null;
};

function formatSessionTypeLabel(type: string): string {
  return type
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function formatTutorSessionSubjectLabel(session: TutorSessionSubjectFields): string {
  const parts: string[] = [];
  if (session.subject_curriculum) parts.push(String(session.subject_curriculum));
  if (session.subject_year_level != null) parts.push(`Year ${session.subject_year_level}`);
  if (session.subject_name) parts.push(session.subject_name);
  if (session.class_level) parts.push(session.class_level);
  if (parts.length > 0) return parts.join(' ');
  if (session.short_name?.trim()) return session.short_name.trim();
  if (session.session_type && session.session_type !== 'CLASS') {
    return formatSessionTypeLabel(session.session_type);
  }
  return '—';
}

export function formatPersonDisplayName(person: {
  first_name?: string | null;
  last_name?: string | null;
}): string {
  return [person.first_name, person.last_name].filter(Boolean).join(' ').trim();
}
