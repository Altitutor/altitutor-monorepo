import type { Tables } from '@altitutor/shared';
import { Badge } from '@altitutor/ui';

/**
 * Get today's date in local timezone (YYYY-MM-DD format)
 */
export function getTodayLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format a date string for display
 */
export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  } catch (e) {
    return dateString;
  }
}

/**
 * Get short display name for a class from session data.
 * Prefers session.short_name or class.short_name from DB when present.
 */
export function getClassShortDisplay(
  session: Tables<'sessions'>,
  classesById: Record<string, Tables<'classes'>>,
  subjectsById: Record<string, Tables<'subjects'>>
): string {
  if (session.short_name?.trim()) return session.short_name.trim();
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  if (cls?.short_name?.trim()) return cls.short_name.trim();
  const subj = cls?.subject_id ? subjectsById[cls.subject_id] : undefined;
  const parts: string[] = [];
  if (subj?.curriculum) parts.push(String(subj.curriculum));
  const yearLevel = subj?.year_level != null ? String(subj.year_level) : '';
  const nickname = subj?.name ? subj.name.substring(0, 4).toUpperCase() : '';
  if (yearLevel || nickname) parts.push(`${yearLevel}${nickname}`);
  return parts.filter(Boolean).join(' ');
}

/**
 * Get full display name for a class from session data.
 * Prefers session.long_name or class.long_name from DB when present.
 */
export function getClassDisplay(
  session: Tables<'sessions'>,
  classesById: Record<string, Tables<'classes'>>,
  subjectsById: Record<string, Tables<'subjects'>>
): string {
  if (session.long_name?.trim()) return session.long_name.trim();
  const cls = session.class_id ? classesById[session.class_id] : undefined;
  if (cls?.long_name?.trim()) return cls.long_name.trim();
  const subj = cls?.subject_id ? subjectsById[cls.subject_id] : undefined;
  const parts: string[] = [];
  if (subj?.curriculum) parts.push(String(subj.curriculum));
  if (subj?.year_level != null) parts.push(String(subj.year_level));
  if (subj?.name) parts.push(subj.name);
  if (cls?.level) parts.push(String(cls.level));
  return parts.join(' ');
}

/**
 * Get time range display for a session
 */
export function getTimeRange(session: Tables<'sessions'>): string {
  const s = session.start_at ? new Date(session.start_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  const e = session.end_at ? new Date(session.end_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  return s && e ? `${s}–${e}` : s || e || '-';
}

/**
 * Get invoice status badge component
 */
export function getInvoiceStatusBadge(status: string | null | undefined): JSX.Element | null {
  if (!status) return null;
  
  let label = '';
  let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'secondary';
  
  if (status === 'draft' || status === 'open') {
    label = 'Sent';
    variant = 'secondary';
  } else if (status === 'paid') {
    label = 'Paid';
    variant = 'default';
  } else if (status === 'void' || status === 'uncollectible' || status === 'disputed') {
    label = 'Failed';
    variant = 'destructive';
  } else {
    label = status;
    variant = 'outline';
  }
  
  return <Badge variant={variant} className="text-xs ml-1">{label}</Badge>;
}
