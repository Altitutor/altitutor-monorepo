import type { ActivityEvent, ActivityEventDisplay, ActivityEventsResponse } from '../types';
import { getActivityTemplate, FIELD_LABELS } from './activityMessageTemplates';
import type { Tables } from '@altitutor/shared';
import { formatClassName } from '@/shared/utils';
import { formatDate, formatTime } from '@/shared/utils/datetime';

/**
 * Format relative time (e.g., "3h ago", "2d ago")
 */
function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffWeeks < 4) return `${diffWeeks}w ago`;
  if (diffMonths < 12) return `${diffMonths}mo ago`;
  return `${Math.floor(diffMonths / 12)}y ago`;
}

/**
 * Get staff name from related entities
 */
function getStaffName(
  staffId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!staffId) return undefined;
  const staff = relatedEntities.staff?.[staffId];
  if (!staff) return undefined;
  return `${staff.first_name} ${staff.last_name}`;
}

/**
 * Get student name from related entities
 */
function getStudentName(
  studentId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!studentId) return undefined;
  const student = relatedEntities.students?.[studentId];
  if (!student) return undefined;
  return `${student.first_name} ${student.last_name}`;
}

/**
 * Get class name from related entities
 */
function getClassName(
  classId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!classId) return undefined;
  const class_ = relatedEntities.classes?.[classId];
  if (!class_) return undefined;
  return formatClassName(class_);
}

/**
 * Get session name from related entities
 */
function getSessionName(
  sessionId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!sessionId) return undefined;
  const session = relatedEntities.sessions?.[sessionId];
  if (!session) return undefined;
  if (session.start_at) {
    const date = new Date(session.start_at);
    return `${formatDate(date.toISOString())} ${formatTime(session.start_at.split('T')[1]?.split('.')[0] || '')}`;
  }
  return `Session ${session.type || ''}`;
}

/**
 * Get parent name from related entities
 */
function getParentName(
  parentId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!parentId) return undefined;
  const parent = relatedEntities.parents?.[parentId];
  if (!parent) return undefined;
  return `${parent.first_name} ${parent.last_name}`;
}

/**
 * Get task title from related entities
 */
function getTaskTitle(
  taskId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!taskId) return undefined;
  const task = relatedEntities.tasks?.[taskId];
  if (!task) return undefined;
  return task.title || undefined;
}

/**
 * Format field value for display
 */
function formatFieldValue(
  value: unknown,
  fieldName: string,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string {
  if (value === null || value === undefined) return '';
  
  // Handle UUIDs that might be foreign keys
  if (typeof value === 'string' && value.length === 36) {
    // Check if it's a staff ID
    const staffName = getStaffName(value, relatedEntities);
    if (staffName) return staffName;
    
    // Check if it's a student ID
    const studentName = getStudentName(value, relatedEntities);
    if (studentName) return studentName;
    
    // Check if it's a class ID
    const className = getClassName(value, relatedEntities);
    if (className) return className;
  }
  
  // Handle status values
  if (fieldName === 'status' && typeof value === 'string') {
    return value.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  }
  
  return String(value);
}

/**
 * Map activity event to display format
 */
export function mapActivityEventToDisplay(
  event: ActivityEvent,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): ActivityEventDisplay {
  const template = getActivityTemplate(event.entity_type, event.event_type, event.changed_fields);
  
  // Get performed by name
  const performedByName = getStaffName(event.performed_by, relatedEntities) || 'Unknown';
  
  // Get related entity names
  const studentName = getStudentName(event.student_id, relatedEntities);
  const staffName = getStaffName(event.staff_id, relatedEntities);
  const className = getClassName(event.class_id, relatedEntities);
  const sessionName = getSessionName(event.session_id, relatedEntities);
  const parentName = getParentName(event.parent_id, relatedEntities);
  const taskTitle = getTaskTitle(event.task_id, relatedEntities);
  
  // Handle changed fields for UPDATE events
  let oldValue: string | undefined;
  let newValue: string | undefined;
  const fieldLabels: Record<string, string> = {};
  
  if (event.changed_fields && event.event_type === 'UPDATED') {
    const changedFieldsObj = typeof event.changed_fields === 'object' && event.changed_fields !== null && !Array.isArray(event.changed_fields)
      ? event.changed_fields as Record<string, unknown>
      : null;
    
    if (changedFieldsObj) {
      const changedFieldNames = Object.keys(changedFieldsObj);
      if (changedFieldNames.length > 0) {
        const firstField = changedFieldNames[0];
        const fieldChange = changedFieldsObj[firstField] as { old: unknown; new: unknown } | undefined;
        if (fieldChange && typeof fieldChange === 'object' && 'old' in fieldChange && 'new' in fieldChange) {
          fieldLabels[firstField] = FIELD_LABELS[firstField] || firstField;
          oldValue = formatFieldValue(fieldChange.old, firstField, relatedEntities);
          newValue = formatFieldValue(fieldChange.new, firstField, relatedEntities);
        }
      }
    }
  }
  
  // Build message context
  const context = {
    performedByName,
    studentName,
    staffName,
    className,
    sessionName,
    parentName,
    taskTitle,
    fieldLabels,
    oldValue,
    newValue,
  };
  
  // Generate message
  const message = template.messageTemplate(event, context);
  
  // Build related entities for display
  const relatedEntitiesDisplay: ActivityEventDisplay['relatedEntities'] = {};
  
  if (event.student_id && studentName) {
    relatedEntitiesDisplay.student = {
      id: event.student_id,
      name: studentName,
      type: 'student',
    };
  }
  
  if (event.staff_id && staffName) {
    relatedEntitiesDisplay.staff = {
      id: event.staff_id,
      name: staffName,
      type: 'staff',
    };
  }
  
  if (event.class_id && className) {
    relatedEntitiesDisplay.class = {
      id: event.class_id,
      name: className,
      type: 'class',
    };
  }
  
  if (event.session_id && sessionName) {
    relatedEntitiesDisplay.session = {
      id: event.session_id,
      name: sessionName,
      type: 'session',
    };
  }
  
  if (event.parent_id && parentName) {
    relatedEntitiesDisplay.parent = {
      id: event.parent_id,
      name: parentName,
      type: 'parent',
    };
  }
  
  if (event.task_id && taskTitle) {
    relatedEntitiesDisplay.task = {
      id: event.task_id,
      name: taskTitle,
      type: 'task',
    };
  }
  
  return {
    id: event.id,
    icon: template.icon,
    iconColor: template.color,
    message,
    timestamp: formatRelativeTime(event.performed_at),
    performedAt: event.performed_at,
    performedBy: {
      id: event.performed_by || '',
      name: performedByName,
    },
    relatedEntities: Object.keys(relatedEntitiesDisplay).length > 0 ? relatedEntitiesDisplay : undefined,
    metadata: (typeof event.metadata === 'object' && event.metadata !== null && !Array.isArray(event.metadata))
      ? event.metadata as Record<string, unknown>
      : {},
  };
}

/**
 * Map multiple activity events to display format
 */
export function mapActivityEventsToDisplay(
  response: ActivityEventsResponse
): ActivityEventDisplay[] {
  return response.events.map((event) => mapActivityEventToDisplay(event, response.relatedEntities));
}

