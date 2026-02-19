import type { Tables } from '@altitutor/shared';

/**
 * Minimal class type from classes API
 */
type MinimalClass = Pick<
  Tables<'classes'>,
  'id' | 'day_of_week' | 'start_time' | 'end_time' | 'status' | 'room' | 'subject_id' | 'level'
> & {
  subject?: Tables<'subjects'> | null;
  studentCount?: number;
  students?: Tables<'students'>[];
  staff?: Tables<'staff'>[];
};

/**
 * Entity result type for command palette search
 * Represents a searchable entity (student, staff, parent, class, subject, topic, or file)
 */
export type CommandPaletteEntityResult = 
  | { type: 'student'; id: string; data: Tables<'students'> }
  | { type: 'staff'; id: string; data: Pick<Tables<'staff'>, 'id' | 'first_name' | 'last_name' | 'role' | 'status' | 'email' | 'phone_number'> }
  | { type: 'parent'; id: string; data: Pick<Tables<'parents'>, 'id' | 'first_name' | 'last_name' | 'email' | 'phone'> }
  | { type: 'class'; id: string; data: MinimalClass }
  | { type: 'subject'; id: string; data: Tables<'subjects'> }
  | { type: 'topic'; id: string; data: Tables<'topics'> & { subject: Tables<'subjects'> } }
  | { type: 'session'; id: string; data: Tables<'sessions'> & { class?: Tables<'classes'> | null; subject?: Tables<'subjects'> | null; staff?: Tables<'staff'> | null } }
  | { type: 'file'; id: string; data: { id: string; topic_id: string; code: string | null; file: { filename: string }; topic: { id: string; name: string }; subject: { short_name: string | null; long_name: string | null } } };

/**
 * Options for useCommandPaletteSearch hook
 */
export interface UseCommandPaletteSearchOptions {
  search: string;
  enabled?: boolean;
}
