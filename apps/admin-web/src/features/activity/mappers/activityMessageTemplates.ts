import type { ActivityEvent, ActivityIconType, ActivityIconColor } from '../types';

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
          messageTemplate: (event, ctx) => `${ctx.performedByName} added a note`,
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
        messageTemplate: (event, ctx) => `${ctx.performedByName} updated ${entityType === 'students' ? 'student' : entityType === 'staff' ? 'staff' : 'name'}`,
      };
    }

    // Generic update
    return {
      icon: 'user-edit',
      color: 'blue',
      messageTemplate: (event, ctx) => {
        const fieldLabel = ctx.fieldLabels?.[changedFieldNames[0]] || changedFieldNames[0];
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
};

