import type { ActivityEvent, ActivityIconType, ActivityIconColor, ActivityEventDisplay, ActivityEventsResponse } from '../types';

/**
 * Template for activity message generation
 */
interface ActivityTemplate {
  icon: ActivityIconType;
  color: ActivityIconColor;
  messageTemplate: (event: ActivityEvent, context: ActivityMessageContext) => string;
}

/**
 * Context for message generation
 */
export interface ActivityMessageContext {
  performedByName: string;
  studentName?: string;
  staffName?: string;
  className?: string;
  sessionName?: string;
  parentName?: string;
  taskTitle?: string;
  subjectName?: string;
  noteContent?: string;
  fieldLabels?: Record<string, string>;
  oldValue?: string;
  newValue?: string;
}

/**
 * Get activity template based on entity type and event type
 */
export function getActivityTemplate(
  entityType: ActivityEvent['entity_type'],
  eventType: ActivityEvent['event_type'],
  changedFields?: ActivityEvent['changed_fields']
): ActivityTemplate {
  // Handle CREATED events
  if (eventType === 'CREATED') {
    switch (entityType) {
      case 'students':
        return {
          icon: 'user-plus',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the student ${ctx.studentName || ''}`,
        };
      case 'staff':
        return {
          icon: 'user-plus',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the staff member ${ctx.staffName || ''}`,
        };
      case 'classes':
        return {
          icon: 'class-plus',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the class ${ctx.className || ''}`,
        };
      case 'sessions':
        return {
          icon: 'session-plus',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the session ${ctx.sessionName || ''}`,
        };
      case 'tasks':
        return {
          icon: 'flag',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the task ${ctx.taskTitle || ''}`,
        };
      case 'parents':
        return {
          icon: 'user-plus',
          color: 'blue',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created the parent ${ctx.parentName || ''}`,
        };
      case 'notes':
        return {
          icon: 'note',
          color: 'blue',
          messageTemplate: (event, ctx) => {
            if (ctx.noteContent) {
              // Truncate long notes to 100 characters
              const truncated = ctx.noteContent.length > 100 
                ? ctx.noteContent.substring(0, 100) + '...'
                : ctx.noteContent;
              return `${ctx.performedByName} added a note: "${truncated}"`;
            }
            return `${ctx.performedByName} added a note`;
          },
        };
      case 'classes_students':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} enrolled ${ctx.studentName || 'student'} in ${ctx.className || 'class'}`,
        };
      case 'classes_staff':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} assigned ${ctx.staffName || 'staff'} to ${ctx.className || 'class'}`,
        };
      case 'sessions_students':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} added ${ctx.studentName || 'student'} to ${ctx.sessionName || 'session'}`,
        };
      case 'sessions_staff':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} assigned ${ctx.staffName || 'staff'} to ${ctx.sessionName || 'session'}`,
        };
      case 'parents_students':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} linked ${ctx.studentName || 'student'} to ${ctx.parentName || 'parent'}`,
        };
      case 'students_subjects':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) => `${ctx.performedByName} added ${ctx.subjectName || 'subject'} to ${ctx.studentName || 'student'}`,
        };
      default:
        return {
          icon: 'default',
          color: 'gray',
          messageTemplate: (event, ctx) => `${ctx.performedByName} created ${entityType}`,
        };
    }
  }

  // Handle DELETED events
  if (eventType === 'DELETED') {
    switch (entityType) {
      case 'students':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted the student`,
        };
      case 'staff':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted the staff member`,
        };
      case 'classes':
        return {
          icon: 'class-edit',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted the class`,
        };
      case 'sessions':
        return {
          icon: 'session-edit',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted the session`,
        };
      case 'tasks':
        return {
          icon: 'x',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted the task`,
        };
      case 'classes_students':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} unenrolled ${ctx.studentName || 'student'} from ${ctx.className || 'class'}`,
        };
      case 'classes_staff':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} removed ${ctx.staffName || 'staff'} from ${ctx.className || 'class'}`,
        };
      case 'sessions_students':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} removed ${ctx.studentName || 'student'} from ${ctx.sessionName || 'session'}`,
        };
      case 'sessions_staff':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} removed ${ctx.staffName || 'staff'} from ${ctx.sessionName || 'session'}`,
        };
      default:
        return {
          icon: 'x',
          color: 'red',
          messageTemplate: (event, ctx) => `${ctx.performedByName} deleted ${entityType}`,
        };
    }
  }

  // Handle UPDATED events
  if (eventType === 'UPDATED' && changedFields) {
    const changedFieldsObj = typeof changedFields === 'object' && changedFields !== null && !Array.isArray(changedFields)
      ? changedFields as Record<string, unknown>
      : null;
    
    if (!changedFieldsObj) {
      return {
        icon: 'default',
        color: 'gray',
        messageTemplate: (event, ctx) => `${ctx.performedByName} updated ${entityType}`,
      };
    }
    
    const changedFieldNames = Object.keys(changedFieldsObj);
    
    // Status changes
    if (changedFieldNames.includes('status')) {
      const statusChange = changedFieldsObj.status as { old: string; new: string } | undefined;
      if (!statusChange || typeof statusChange !== 'object' || !('old' in statusChange) || !('new' in statusChange)) {
        return {
          icon: 'default',
          color: 'gray',
          messageTemplate: (event, ctx) => `${ctx.performedByName} updated ${entityType}`,
        };
      }
      switch (entityType) {
        case 'tasks':
          return {
            icon: 'arrow-right',
            color: 'green',
            messageTemplate: (event, ctx) => 
              `${ctx.performedByName} moved task from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`,
          };
        case 'students':
          return {
            icon: 'arrow-right',
            color: 'green',
            messageTemplate: (event, ctx) => 
              `${ctx.performedByName} changed student status from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`,
          };
        default:
          return {
            icon: 'arrow-right',
            color: 'green',
            messageTemplate: (event, ctx) => 
              `${ctx.performedByName} changed status from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`,
          };
      }
    }

    // Assignment changes
    if (changedFieldNames.includes('assigned_to')) {
      return {
        icon: 'user-edit',
        color: 'blue',
        messageTemplate: (event, ctx) => {
          if (ctx.newValue && ctx.oldValue) {
            return `${ctx.performedByName} reassigned task from ${ctx.oldValue} to ${ctx.newValue}`;
          } else if (ctx.newValue) {
            return `${ctx.performedByName} assigned task to ${ctx.newValue}`;
          } else {
            return `${ctx.performedByName} unassigned task`;
          }
        },
      };
    }

    // Name changes
    if (changedFieldNames.includes('first_name') || changedFieldNames.includes('last_name')) {
      return {
        icon: 'user-edit',
        color: 'blue',
        messageTemplate: (event, ctx) => {
          if (ctx.oldValue && ctx.newValue) {
            return `${ctx.performedByName} updated ${entityType === 'students' ? 'student' : entityType === 'staff' ? 'staff' : 'name'} from ${ctx.oldValue} to ${ctx.newValue}`;
          }
          return `${ctx.performedByName} updated ${entityType === 'students' ? 'student' : entityType === 'staff' ? 'staff' : 'name'}`;
        },
      };
    }

    // Generic update - show old/new values when available
    return {
      icon: 'user-edit',
      color: 'blue',
      messageTemplate: (event, ctx) => {
        const fieldLabel = ctx.fieldLabels?.[changedFieldNames[0]] || changedFieldNames[0];
        if (ctx.oldValue && ctx.newValue) {
          return `${ctx.performedByName} updated ${fieldLabel} from ${ctx.oldValue} to ${ctx.newValue}`;
        }
        return `${ctx.performedByName} updated ${fieldLabel}`;
      },
    };
  }

  // Default template
  return {
    icon: 'default',
    color: 'gray',
    messageTemplate: (event, ctx) => `${ctx.performedByName} updated ${entityType}`,
  };
}

/**
 * Field labels for common fields
 */
export const FIELD_LABELS: Record<string, string> = {
  status: 'status',
  assigned_to: 'assignee',
  first_name: 'first name',
  last_name: 'last name',
  email: 'email',
  phone: 'phone',
  start_at: 'start time',
  end_at: 'end time',
  level: 'level',
  subject_id: 'subject',
  school: 'school',
  curriculum: 'curriculum',
  year_level: 'year level',
  phone_number: 'phone number',
  student_phone: 'student phone',
  student_email: 'student email',
  parent_first_name: 'parent first name',
  parent_last_name: 'parent last name',
};

/**
 * Get grouped activity message template
 */
export function getGroupedActivityTemplate(
  activity: ActivityEventDisplay,
  count: number,
  groupedEntityIds: string[],
  relatedEntities: ActivityEventsResponse['relatedEntities'],
  changedFieldName?: string
): string {
  const performedByName = activity.performedBy.name;
  const targetEntity = activity.relatedEntities?.student || activity.relatedEntities?.staff;
  const targetName = targetEntity?.name || '';
  
  // Determine entity type from activity
  const entityType = activity.relatedEntities?.session ? 'session' : 
                     activity.relatedEntities?.class ? 'class' : 
                     undefined;
  
  // Generate message based on icon type
  if (activity.icon === 'user-minus') {
    // Removal events
    if (entityType === 'session') {
      return `${performedByName} removed ${targetName} from ${count} sessions`;
    } else if (entityType === 'class') {
      return `${performedByName} removed ${targetName} from ${count} classes`;
    } else {
      return `${performedByName} removed ${targetName} ${count} times`;
    }
  } else if (activity.icon === 'user-plus') {
    // Addition events
    if (entityType === 'session') {
      return `${performedByName} added ${targetName} to ${count} sessions`;
    } else if (entityType === 'class') {
      return `${performedByName} added ${targetName} to ${count} classes`;
    } else {
      return `${performedByName} added ${targetName} ${count} times`;
    }
  } else if (activity.icon === 'x') {
    // Deletion events
    return `${performedByName} deleted ${count} items`;
  } else if (activity.icon === 'user-edit' || activity.icon === 'arrow-right') {
    // UPDATE events - use simple message format
    if (entityType === 'session') {
      return `${performedByName} updated ${count} sessions`;
    } else if (entityType === 'class') {
      return `${performedByName} updated ${count} classes`;
    } else {
      // Fallback if field name not available
      if (changedFieldName) {
        const fieldLabel = FIELD_LABELS[changedFieldName] || changedFieldName.replace(/_/g, ' ');
        return `${performedByName} updated ${fieldLabel} ${count} times`;
      } else {
        return `${performedByName} updated ${count} items`;
      }
    }
  }
  
  // Fallback
  return `${performedByName} performed ${count} similar actions`;
}

