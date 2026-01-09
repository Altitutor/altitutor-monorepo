import type { Tables } from '@altitutor/shared';

/**
 * Raw activity event from database
 */
export type ActivityEvent = Tables<'activity_events'>;

/**
 * Entity type for activity events
 * 
 * Note: This list matches the tables that have activity event triggers in the database migration.
 * Excluded tables: messages, conversation_reads (not tracked via activity_events)
 */
export type ActivityEntityType = 
  | 'students'
  | 'staff'
  | 'classes'
  | 'sessions'
  | 'tasks'
  | 'parents'
  | 'notes'
  | 'invoices'
  | 'classes_staff'
  | 'classes_students'
  | 'sessions_students'
  | 'sessions_staff'
  | 'sessions_files'
  | 'parents_students'
  | 'invoice_items'
  | 'student_subsidies'
  | 'students_subjects'
  | 'tutor_logs'
  | 'tutor_logs_staff_attendance'
  | 'tutor_logs_student_attendance'
  | 'tutor_logs_topics'
  | 'tutor_logs_topics_files'
  | 'tutor_logs_topics_files_students'
  | 'tutor_logs_topics_students';

/**
 * Event type
 */
export type ActivityEventType = 'CREATED' | 'UPDATED' | 'DELETED' | 'FIELD_CHANGED';

/**
 * Icon type for activity items
 */
export type ActivityIconType = 
  | 'user-plus'
  | 'user-minus'
  | 'user-edit'
  | 'class-plus'
  | 'class-edit'
  | 'session-plus'
  | 'session-edit'
  | 'message'
  | 'note'
  | 'file'
  | 'flag'
  | 'check'
  | 'x'
  | 'arrow-right'
  | 'arrow-left'
  | 'circle'
  | 'default';

/**
 * Icon color for activity items
 */
export type ActivityIconColor = 'blue' | 'green' | 'gray' | 'yellow' | 'red' | 'purple';

/**
 * Related entity information
 */
export interface RelatedEntity {
  id: string;
  name: string;
  type?: string;
}

/**
 * Performed by information
 */
export interface PerformedBy {
  id: string;
  name: string;
  avatar?: string;
}

/**
 * Activity event display object (translated for UI)
 */
export interface ActivityEventDisplay {
  id: string;
  icon: ActivityIconType;
  iconColor: ActivityIconColor;
  message: string;
  timestamp: string;
  performedAt: string; // ISO string for sorting
  performedBy: PerformedBy;
  relatedEntities?: {
    student?: RelatedEntity;
    staff?: RelatedEntity;
    class?: RelatedEntity;
    session?: RelatedEntity;
    parent?: RelatedEntity;
    task?: RelatedEntity;
  };
  metadata?: Record<string, unknown>;
}

/**
 * Activity events query parameters
 */
export interface ActivityEventsParams {
  entityType?: ActivityEntityType;
  entityId?: string;
  studentId?: string;
  staffId?: string;
  classId?: string;
  sessionId?: string;
  parentId?: string;
  limit?: number;
  offset?: number;
}

/**
 * Activity events response with related entities
 */
export interface ActivityEventsResponse {
  events: ActivityEvent[];
  relatedEntities: {
    staff?: Record<string, Tables<'staff'>>;
    students?: Record<string, Tables<'students'>>;
    classes?: Record<string, Tables<'classes'>>;
    sessions?: Record<string, Tables<'sessions'>>;
    parents?: Record<string, Tables<'parents'>>;
    tasks?: Record<string, Tables<'tasks'>>;
  };
  total: number;
}

