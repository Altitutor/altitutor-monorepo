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
  issueName?: string;
  projectName?: string;
  subjectName?: string;
  noteContent?: string;
  formName?: string;
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
      case 'issues':
        return {
          icon: 'flag',
          color: 'blue',
          messageTemplate: (_event, ctx) => `${ctx.performedByName} created the issue ${ctx.issueName || ''}`,
        };
      case 'projects':
        return {
          icon: 'flag',
          color: 'blue',
          messageTemplate: (_event, ctx) => `${ctx.performedByName} created the project ${ctx.projectName || ''}`,
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
          messageTemplate: (_event, ctx) =>
            `${ctx.performedByName} added ${ctx.subjectName || 'subject'} to ${ctx.studentName || 'student'}`,
        };
      case 'tutor_logs':
        return {
          icon: 'check',
          color: 'green',
          messageTemplate: (event, ctx) =>
            `${ctx.performedByName} submitted a tutor log for ${ctx.sessionName || 'session'}`,
        };
      case 'tutor_logs_staff_attendance':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) =>
            `${ctx.performedByName} logged staff attendance for ${ctx.staffName || 'staff'} on ${ctx.sessionName || 'session'}`,
        };
      case 'tutor_logs_student_attendance':
        return {
          icon: 'user-plus',
          color: 'green',
          messageTemplate: (event, ctx) =>
            `${ctx.performedByName} logged student attendance for ${ctx.studentName || 'student'} on ${ctx.sessionName || 'session'}`,
        };
      case 'tutor_logs_topics':
      case 'tutor_logs_topics_students':
      case 'tutor_logs_topics_files':
      case 'tutor_logs_topics_files_students':
        return {
          icon: 'flag',
          color: 'blue',
          messageTemplate: (event, ctx) =>
            `${ctx.performedByName} logged topics for ${ctx.sessionName || 'session'}`,
        };
      case 'form_responses':
        return {
          icon: 'check',
          color: 'green',
          messageTemplate: (_event, ctx) =>
            `${ctx.performedByName} recorded a response${ctx.formName ? ` to ${ctx.formName}` : ''}`,
        };
      case 'invoices':
        return {
          icon: 'default',
          color: 'gray',
          messageTemplate: (_event, ctx) =>
            `${ctx.performedByName} created an invoice${ctx.studentName ? ` for ${ctx.studentName}` : ''}`,
        };
      case 'invoice_items':
        return {
          icon: 'default',
          color: 'gray',
          messageTemplate: (_event, ctx) =>
            `${ctx.performedByName} added an invoice item${ctx.studentName ? ` for ${ctx.studentName}` : ''}`,
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
      case 'issues':
        return {
          icon: 'x',
          color: 'red',
          messageTemplate: (_event, ctx) => `${ctx.performedByName} deleted the issue ${ctx.issueName || ''}`.trim(),
        };
      case 'projects':
        return {
          icon: 'x',
          color: 'red',
          messageTemplate: (_event, ctx) => `${ctx.performedByName} deleted the project ${ctx.projectName || ''}`.trim(),
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
      case 'students_subjects':
        return {
          icon: 'user-minus',
          color: 'red',
          messageTemplate: (_event, ctx) =>
            `${ctx.performedByName} removed ${ctx.subjectName || 'subject'} from ${ctx.studentName || 'student'}`,
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
  if (eventType === 'UPDATED' && entityType === 'form_responses') {
    return {
      icon: 'check',
      color: 'green',
      messageTemplate: (_event, ctx) =>
        `${ctx.performedByName} updated a response${ctx.formName ? ` to ${ctx.formName}` : ''}`,
    };
  }

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
              `${ctx.performedByName} moved task ${ctx.taskTitle || ''} from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`.replace(/\s+/g, ' ').trim(),
          };
        case 'issues':
          return {
            icon: 'arrow-right',
            color: 'green',
            messageTemplate: (_event, ctx) =>
              `${ctx.performedByName} moved issue ${ctx.issueName || ''} from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`.replace(/\s+/g, ' ').trim(),
          };
        case 'projects':
          return {
            icon: 'arrow-right',
            color: 'green',
            messageTemplate: (_event, ctx) =>
              `${ctx.performedByName} moved project ${ctx.projectName || ''} from ${ctx.oldValue || statusChange.old} to ${ctx.newValue || statusChange.new}`.replace(/\s+/g, ' ').trim(),
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
          const entityLabel =
            entityType === 'issues' ? 'issue' : entityType === 'projects' ? 'project' : 'task';
          const entityName =
            entityType === 'issues'
              ? ctx.issueName
              : entityType === 'projects'
                ? ctx.projectName
                : ctx.taskTitle;
          const prefix = entityName
            ? `${ctx.performedByName} reassigned ${entityLabel} ${entityName}`
            : `${ctx.performedByName} reassigned ${entityLabel}`;
          if (ctx.newValue && ctx.oldValue) {
            return `${prefix} from ${ctx.oldValue} to ${ctx.newValue}`;
          } else if (ctx.newValue) {
            return `${ctx.performedByName} assigned ${entityLabel}${entityName ? ` ${entityName}` : ''} to ${ctx.newValue}`;
          } else {
            return `${ctx.performedByName} unassigned ${entityLabel}${entityName ? ` ${entityName}` : ''}`;
          }
        },
      };
    }

    if (changedFieldNames.includes('project_lead_id')) {
      return {
        icon: 'user-edit',
        color: 'blue',
        messageTemplate: (_event, ctx) => {
          const name = ctx.projectName ? ` ${ctx.projectName}` : '';
          if (ctx.newValue && ctx.oldValue) {
            return `${ctx.performedByName} changed project lead${name} from ${ctx.oldValue} to ${ctx.newValue}`;
          }
          if (ctx.newValue) {
            return `${ctx.performedByName} set project lead${name} to ${ctx.newValue}`;
          }
          return `${ctx.performedByName} cleared project lead${name}`;
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
  project_lead_id: 'project lead',
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
  is_credited: 'credited',
  credited_at: 'credited at',
  credited_by: 'credited by',
  is_rescheduled: 'rescheduled',
  rescheduled_at: 'rescheduled at',
  rescheduled_sessions_students_id: 'rescheduled session',
  planned_absence: 'planned absence',
  planned_absence_logged_at: 'planned absence logged at',
  planned_absence_logged_by: 'planned absence logged by',
  is_swapped: 'swapped',
  swapped_at: 'swapped at',
  swapped_sessions_staff_id: 'swap replacement',
  unenrolled_at: 'unenrolled at',
  unenrolled_by: 'unenrolled by',
  unassigned_at: 'unassigned at',
  unassigned_by: 'unassigned by',
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
