import type { ActivityEvent, ActivityEventDisplay, ActivityEventsResponse, ChangedField } from '../types';
import { getActivityTemplate, getGroupedActivityTemplate, FIELD_LABELS } from './activityMessageTemplates';
import { coalesceRelatedEvents } from './activityEventCoalescer';
import type { Tables } from '@altitutor/shared';
import { formatClassName, formatSubjectShortName } from '@/shared/utils';
import { extractTextFromNoteContent } from '@/shared/utils/noteContentUtils';
import { formatDate, formatActivityTimestamp } from '@/shared/utils/datetime';

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
  
  // Get subject short name directly from session
  let subjectShortName = '';
  const sessionWithSubjectId = session as Tables<'sessions'> & { subject_id?: string | null };
  if (sessionWithSubjectId.subject_id) {
    const subject = relatedEntities.subjects?.[sessionWithSubjectId.subject_id];
    if (subject) {
      subjectShortName = formatSubjectShortName(subject);
    }
  }
  
  if (session.start_at) {
    const date = new Date(session.start_at);
    // Use the Date object's local time methods instead of extracting UTC string
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    const paddedMinutes = minutes.toString().padStart(2, '0');
    const timeStr = `${hour12}:${paddedMinutes} ${ampm}`;
    const datetimeStr = `${formatDate(date.toISOString())} ${timeStr}`;
    return subjectShortName ? `${subjectShortName} ${datetimeStr}` : datetimeStr;
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
 * Get note content from related entities.
 * Returns raw note content (TipTap JSON or plain text) for NoteContentDisplay.
 */
function getNoteContent(
  noteId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): Record<string, unknown> | string | undefined {
  if (!noteId) return undefined;
  const note = relatedEntities.notes?.[noteId];
  if (!note) return undefined;
  return note.note as Record<string, unknown> | string | undefined;
}

/**
 * Get subject name from related entities
 */
function getSubjectName(
  subjectId: string | null | undefined,
  relatedEntities: ActivityEventsResponse['relatedEntities']
): string | undefined {
  if (!subjectId) return undefined;
  const subject = relatedEntities.subjects?.[subjectId];
  if (!subject) return undefined;
  // Prefer short_name or long_name, fallback to name
  return subject.short_name || subject.long_name || subject.name || undefined;
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
  
  // Handle date/time values - check for ISO date strings or date/time field names
  const dateTimeFieldNames = ['start_at', 'end_at', 'created_at', 'updated_at', 'performed_at', 'credited_at', 'date', 'time'];
  const isDateTimeField = dateTimeFieldNames.some(name => fieldName.includes(name));
  
  if (typeof value === 'string') {
    // Check if it's an ISO date string (matches formats like "2026-01-13T08:45:00+00:00" or "2026-01-13T08:45:00Z")
    // Supports fractional seconds with any number of digits (milliseconds or microseconds)
    const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})?$/;
    if (isoDateRegex.test(value) || isDateTimeField) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return formatActivityTimestamp(date);
        }
      } catch (e) {
        // If parsing fails, fall through to other handling
      }
    }
    
    // Handle UUIDs that might be foreign keys (only if not a date/time)
    if (value.length === 36 && !isDateTimeField) {
      // Check if it's a subject ID
      if (fieldName === 'subject_id' || fieldName.includes('subject')) {
        const subjectName = getSubjectName(value, relatedEntities);
        if (subjectName) return subjectName;
      }
      
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
  relatedEntities: ActivityEventsResponse['relatedEntities'],
  studentsSubjectsToSubjectId?: Record<string, string>
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
  
  // For notes CREATED events, get note content (raw for display, text for message template)
  let noteContent: Record<string, unknown> | string | undefined;
  let noteContentForMessage: string | undefined;
  if (event.entity_type === 'notes' && event.event_type === 'CREATED') {
    const raw = getNoteContent(event.entity_id, relatedEntities);
    noteContent = raw;
    noteContentForMessage =
      raw != null
        ? typeof raw === 'string'
          ? raw
          : extractTextFromNoteContent(raw as import('@altitutor/shared').Json)
        : undefined;
  }
  
  // For students_subjects CREATED events, extract subject_id from the entity
  let subjectName: string | undefined;
  if (event.entity_type === 'students_subjects' && event.event_type === 'CREATED' && studentsSubjectsToSubjectId) {
    const subjectId = studentsSubjectsToSubjectId[event.entity_id];
    if (subjectId) {
      subjectName = getSubjectName(subjectId, relatedEntities);
    }
  }
  
  // Handle changed fields for UPDATE events
  let oldValue: string | undefined;
  let newValue: string | undefined;
  let changedFieldName: string | undefined;
  let changedFieldLabel: string | undefined;
  const changedFields: ChangedField[] = [];
  const fieldLabels: Record<string, string> = {};
  
  if (event.changed_fields && event.event_type === 'UPDATED') {
    const changedFieldsObj = typeof event.changed_fields === 'object' && event.changed_fields !== null && !Array.isArray(event.changed_fields)
      ? event.changed_fields as Record<string, unknown>
      : null;
    
    if (changedFieldsObj) {
      const changedFieldNames = Object.keys(changedFieldsObj);
      
      // Process all changed fields
      for (const fieldName of changedFieldNames) {
        const fieldChange = changedFieldsObj[fieldName] as { old: unknown; new: unknown } | undefined;
        if (fieldChange && typeof fieldChange === 'object' && 'old' in fieldChange && 'new' in fieldChange) {
          const fieldLabel = FIELD_LABELS[fieldName] || fieldName.replace(/_/g, ' ');
          const formattedOldValue = formatFieldValue(fieldChange.old, fieldName, relatedEntities);
          const formattedNewValue = formatFieldValue(fieldChange.new, fieldName, relatedEntities);
          
          changedFields.push({
            fieldName,
            fieldLabel,
            oldValue: formattedOldValue || undefined,
            newValue: formattedNewValue || undefined,
          });
          
          fieldLabels[fieldName] = fieldLabel;
        }
      }
      
      // Keep first field for backward compatibility (grouping, etc.)
      if (changedFieldNames.length > 0) {
        const firstField = changedFieldNames[0];
        changedFieldName = firstField;
        const firstFieldChange = changedFieldsObj[firstField] as { old: unknown; new: unknown } | undefined;
        if (firstFieldChange && typeof firstFieldChange === 'object' && 'old' in firstFieldChange && 'new' in firstFieldChange) {
          changedFieldLabel = FIELD_LABELS[firstField] || firstField.replace(/_/g, ' ');
          oldValue = formatFieldValue(firstFieldChange.old, firstField, relatedEntities);
          newValue = formatFieldValue(firstFieldChange.new, firstField, relatedEntities);
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
    subjectName,
    noteContent: noteContentForMessage,
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
    timestamp: formatActivityTimestamp(event.performed_at),
    performedAt: event.performed_at,
    performedBy: {
      id: event.performed_by || '',
      name: performedByName,
    },
    relatedEntities: Object.keys(relatedEntitiesDisplay).length > 0 ? relatedEntitiesDisplay : undefined,
    metadata: (typeof event.metadata === 'object' && event.metadata !== null && !Array.isArray(event.metadata))
      ? event.metadata as Record<string, unknown>
      : {},
    changedFields: changedFields.length > 0 ? changedFields : undefined, // Store all changed fields
    changedFieldName, // Store for grouping UPDATE events (backward compatibility)
    changedFieldLabel, // Store human-readable field label for display (backward compatibility)
    oldValue, // Store old value for display formatting (backward compatibility)
    newValue, // Store new value for display formatting (backward compatibility)
    entityId: event.entity_id, // Store entity ID for grouping (e.g., session ID for session updates)
    noteContent, // Store full note content for preserving line breaks
  };
}

/**
 * Check if two activities can be grouped together
 */
function canGroupActivities(
  a: ActivityEventDisplay,
  b: ActivityEventDisplay,
  timeWindowMs: number = 5 * 60 * 1000 // 5 minutes default
): boolean {
  // Must have same performer
  if (a.performedBy.id !== b.performedBy.id) return false;
  
  // Must have same icon and color (indicates same type of action)
  if (a.icon !== b.icon || a.iconColor !== b.iconColor) return false;
  
  // Must be within time window
  const timeDiff = Math.abs(new Date(a.performedAt).getTime() - new Date(b.performedAt).getTime());
  if (timeDiff > timeWindowMs) return false;
  
  // For deletion/removal events, check if they're removing the same entity type
  // (e.g., removing same student from different sessions)
  if (a.icon === 'user-minus' || a.icon === 'x') {
    // Check if same target entity (student/staff being removed)
    const aTargetId = a.relatedEntities?.student?.id || a.relatedEntities?.staff?.id;
    const bTargetId = b.relatedEntities?.student?.id || b.relatedEntities?.staff?.id;
    
    if (aTargetId && bTargetId && aTargetId === bTargetId) {
      // Same target entity - check if different parent entity (e.g., different sessions)
      const aParentId = a.relatedEntities?.session?.id || a.relatedEntities?.class?.id;
      const bParentId = b.relatedEntities?.session?.id || b.relatedEntities?.class?.id;
      
      // If they have different parent entities, they can be grouped
      if (aParentId && bParentId && aParentId !== bParentId) {
        return true;
      }
    }
  }
  
  // For creation/addition events, check if adding same entity to different parents
  if (a.icon === 'user-plus') {
    const aTargetId = a.relatedEntities?.student?.id || a.relatedEntities?.staff?.id;
    const bTargetId = b.relatedEntities?.student?.id || b.relatedEntities?.staff?.id;
    
    if (aTargetId && bTargetId && aTargetId === bTargetId) {
      const aParentId = a.relatedEntities?.session?.id || a.relatedEntities?.class?.id;
      const bParentId = b.relatedEntities?.session?.id || b.relatedEntities?.class?.id;
      
      if (aParentId && bParentId && aParentId !== bParentId) {
        return true;
      }
    }
  }
  
  // For UPDATE events (user-edit or arrow-right icons), check if updating same field
  // on different entities (e.g., different sessions)
  if (a.icon === 'user-edit' || a.icon === 'arrow-right') {
    // Must be updating the same field
    if (a.changedFieldName && b.changedFieldName && a.changedFieldName === b.changedFieldName) {
      // Check if they're updating different entities using entityId (most reliable)
      if (a.entityId && b.entityId) {
        // If entity IDs are different, they're updating different entities - group them
        if (a.entityId !== b.entityId) {
          return true;
        }
        // If entity IDs are the same, don't group (same entity being updated)
        return false;
      }
      
      // Fallback: check session IDs in relatedEntities
      const aSessionId = a.relatedEntities?.session?.id;
      const bSessionId = b.relatedEntities?.session?.id;
      
      // If both have sessions and they're different, group them
      if (aSessionId && bSessionId && aSessionId !== bSessionId) {
        // Optional: also check if they have the same class (if available)
        const aClassId = a.relatedEntities?.class?.id;
        const bClassId = b.relatedEntities?.class?.id;
        
        // If class_id is available, ensure they match; otherwise, allow grouping
        if (!aClassId || !bClassId || aClassId === bClassId) {
          return true;
        }
      }
      
      // If we can't verify entity IDs but they're consecutive UPDATE events
      // with the same field, assume they're different entities and group them
      // This handles edge cases where entity lookup failed
      // (Only if we don't have entityId - if we had it and they matched, we'd have returned false above)
      return true;
    }
  }
  
  return false;
}

/**
 * Create a grouped activity from multiple similar activities
 */
function createGroupedActivity(
  activities: ActivityEventDisplay[],
  relatedEntities: ActivityEventsResponse['relatedEntities']
): ActivityEventDisplay {
  if (activities.length === 0) {
    throw new Error('Cannot create grouped activity from empty array');
  }
  
  if (activities.length === 1) {
    return activities[0];
  }
  
  const first = activities[0];
  
  // Collect entity IDs for grouped entities (e.g., session IDs)
  const groupedEntityIds: string[] = [];
  const entityType = first.relatedEntities?.session ? 'session' : 
                     first.relatedEntities?.class ? 'class' : 
                     undefined;
  
  activities.forEach((activity) => {
    const entityId = entityType === 'session' ? activity.relatedEntities?.session?.id :
                     entityType === 'class' ? activity.relatedEntities?.class?.id :
                     undefined;
    if (entityId && !groupedEntityIds.includes(entityId)) {
      groupedEntityIds.push(entityId);
    }
  });
  
  // Get changed field name for UPDATE events
  const changedFieldName = first.changedFieldName;
  
  // Generate grouped message
  const groupedMessage = getGroupedActivityTemplate(
    first,
    activities.length,
    groupedEntityIds,
    relatedEntities,
    changedFieldName
  );
  
  // Use earliest timestamp
  const earliestTimestamp = activities.reduce((earliest, current) => 
    new Date(current.performedAt) < new Date(earliest.performedAt) ? current : earliest
  );
  
  return {
    ...first,
    id: `grouped-${first.id}`,
    message: groupedMessage,
    timestamp: formatActivityTimestamp(earliestTimestamp.performedAt),
    performedAt: earliestTimestamp.performedAt,
    groupedCount: activities.length,
    groupedEntityIds,
    isGrouped: true,
    originalEvents: activities,
    changedFieldName, // Preserve changed field name for UPDATE events
    // Clear detailed fields for grouped activities - details will show when expanded
    changedFields: undefined,
    changedFieldLabel: undefined,
    oldValue: undefined,
    newValue: undefined,
    // Clear related entities to prevent showing session/class details in grouped message
    relatedEntities: undefined,
  };
}

/**
 * Group similar consecutive activities together
 */
function groupSimilarActivities(
  activities: ActivityEventDisplay[],
  relatedEntities: ActivityEventsResponse['relatedEntities']
): ActivityEventDisplay[] {
  if (activities.length === 0) return [];
  
  const grouped: ActivityEventDisplay[] = [];
  let currentGroup: ActivityEventDisplay[] = [activities[0]];
  
  for (let i = 1; i < activities.length; i++) {
    const current = activities[i];
    const previous = currentGroup[currentGroup.length - 1];
    
    if (canGroupActivities(previous, current)) {
      currentGroup.push(current);
    } else {
      // Finalize current group
      if (currentGroup.length > 1) {
        grouped.push(createGroupedActivity(currentGroup, relatedEntities));
      } else {
        grouped.push(currentGroup[0]);
      }
      currentGroup = [current];
    }
  }
  
  // Handle remaining group
  if (currentGroup.length > 1) {
    grouped.push(createGroupedActivity(currentGroup, relatedEntities));
  } else {
    grouped.push(currentGroup[0]);
  }
  
  return grouped;
}

/**
 * Map multiple activity events to display format with coalescing and grouping
 * 
 * Processing pipeline:
 * 1. Map raw events to display format (applies field-level transformations)
 * 2. Coalesce related events into logical actions (combines multi-event patterns)
 * 3. Group similar consecutive activities (groups repeated similar actions)
 */
export function mapActivityEventsToDisplay(
  response: ActivityEventsResponse
): ActivityEventDisplay[] {
  // Step 1: Map raw events to display format
  const mapped = response.events.map((event) => 
    mapActivityEventToDisplay(event, response.relatedEntities, response.studentsSubjectsToSubjectId)
  );
  
  // Step 2: Coalesce related events into logical actions
  // This combines events that represent a single logical action (e.g., rescheduling)
  const coalesced = coalesceRelatedEvents(mapped, response.relatedEntities);
  
  // Step 3: Group similar consecutive activities
  // This groups repeated similar actions (e.g., adding same student to multiple sessions)
  return groupSimilarActivities(coalesced, response.relatedEntities);
}

