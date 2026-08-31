import type { Tables } from '@altitutor/shared';

/**
 * Raw activity event from database
 */
export type ActivityEvent = Tables<'domain_events'>;

/**
 * Entity type for activity events
 * 
 * Core entity types that can own a lifecycle activity feed.
 */
export type ActivityEntityType =
  | 'student'
  | 'parent'
  | 'staff'
  | 'class'
  | 'admin_shift'
  | 'session'
  | 'task'
  | 'issue'
  | 'project'
  | 'invoice'
  | 'form_response'
  | 'note';

/**
 * Event type
 */
export type ActivityEventType = string;

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
 * Information about a single field change in an UPDATE event
 */
export interface ChangedField {
  fieldName: string;
  fieldLabel: string;
  oldValue?: string;
  newValue?: string;
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
    issue?: RelatedEntity;
    project?: RelatedEntity;
  };
  metadata?: Record<string, unknown>;
  // Grouping metadata
  groupedCount?: number; // Number of activities grouped together (if > 1, this is a grouped activity)
  groupedEntityIds?: string[]; // IDs of entities involved in the group (e.g., session IDs)
  isGrouped?: boolean; // Whether this event is a grouped combination of multiple similar events
  originalEvents?: ActivityEventDisplay[]; // Original events that were grouped/coalesced (for expansion)
  // Coalescing metadata (for combining related events into logical actions)
  isCoalesced?: boolean; // Whether this event is a coalesced combination of multiple events
  coalescedPatternName?: string; // Name of the pattern used to coalesce (e.g., 'reschedule')
  // For UPDATE events: array of all changed fields
  changedFields?: ChangedField[];
  // For UPDATE events: the field that was changed (kept for backward compatibility with grouping)
  changedFieldName?: string;
  // For UPDATE events: the human-readable field label (kept for backward compatibility)
  changedFieldLabel?: string;
  // For UPDATE events: the old and new values (kept for backward compatibility)
  oldValue?: string;
  newValue?: string;
  // The entity ID from the original event (useful for grouping)
  entityId?: string;
  // Raw lifecycle subject/event names, retained for contextual actions.
  entityType?: ActivityEntityType | string;
  eventType?: ActivityEventType | string;
  // For note CREATED events: the full note content (TipTap JSON or plain text for rich display)
  noteContent?: Record<string, unknown> | string;
}

/**
 * Activity events query parameters
 */
export interface ActivityEventsParams {
  entityType?: ActivityEntityType;
  entityId?: string;
  entityTypes?: ActivityEntityType[];
  studentId?: string | string[];
  staffId?: string | string[];
  classId?: string | string[];
  sessionId?: string | string[];
  parentId?: string | string[];
  issueId?: string | string[];
  performedByIds?: string[];
  performedAtGte?: string;
  performedAtLte?: string;
  or?: string;
  limit?: number;
  offset?: number;
}

/**
 * Session activity response — includes meeting live-mode hint for polling.
 */
export interface SessionActivityResponse extends ActivityEventsResponse {
  isAdminMeetingLive?: boolean;
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
    issues?: Record<string, Tables<'issues'>>;
    projects?: Record<string, Tables<'projects'>>;
    subjects?: Record<string, Tables<'subjects'>>;
    notes?: Record<string, Tables<'notes'>>;
  };
  // Mapping of students_subjects entity_id to subject_id (live row and/or activity metadata)
  studentsSubjectsToSubjectId?: Record<string, string>;
  // Mapping of tutor_logs_topics entity_id → topic display name (for tutor-log coalesce messages)
  tutorLogTopicNamesByEntityId?: Record<string, string>;
  /** @deprecated Prefer hasMore — exact totals are no longer queried */
  total: number;
  /** True when this page returned a full limit (more rows may exist) */
  hasMore: boolean;
}
