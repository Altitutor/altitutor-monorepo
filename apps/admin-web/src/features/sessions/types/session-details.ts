import type { Tables } from '@altitutor/shared';
import type { SessionTimeInput } from '@altitutor/shared';

/** Subject-like shape for session display (from API joins). */
export type SessionDetailsSubject = Pick<
  Tables<'subjects'>,
  'id' | 'long_name' | 'short_name' | 'name' | 'color'
>;

/** Class-like shape for session display (from API joins). */
export type SessionDetailsClass = Pick<
  Tables<'classes'>,
  'id' | 'day_of_week' | 'start_time' | 'end_time'
> & {
  subject?: SessionDetailsSubject | null;
};

/**
 * Session shape from getSessionWithTutorLog API.
 * Includes subject and class joins for display.
 */
export interface SessionDetailsSession extends SessionTimeInput {
  id: string;
  class_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  type?: string;
  subject?: SessionDetailsSubject | null;
  class?: SessionDetailsClass | null;
}

/**
 * Tutor log topic file with topics_file join.
 */
export interface SessionDetailsTutorLogTopicFile {
  id: string;
  topics_file?: {
    code?: string | null;
    file?: { id: string } | null;
  } | null;
}

/**
 * Tutor log topic with students and files.
 */
export interface SessionDetailsTutorLogTopic {
  id: string;
  topic?: { id: string; code?: string; name?: string } | null;
  students?: Tables<'students'>[];
  files?: SessionDetailsTutorLogTopicFile[];
}

/**
 * Tutor log shape from getSessionWithTutorLog API.
 * Includes created_by_staff and topics with nested students/files.
 */
export interface SessionDetailsTutorLog {
  id: string;
  created_by?: string;
  created_by_staff?: {
    id?: string;
    first_name: string;
    last_name: string;
  } | null;
  topics?: SessionDetailsTutorLogTopic[];
}
