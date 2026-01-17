// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

export function json(resp: any, status = 200) {
  return new Response(JSON.stringify(resp), { 
    status, 
    headers: { 
      'Content-Type': 'application/json',
      ...corsHeaders 
    } 
  });
}

// Evaluate rule conditions against activity event
export function evaluateConditions(conditions: any, activityEvent: any, entityData: any): boolean {
  if (!conditions || Object.keys(conditions).length === 0) {
    return true; // No conditions = always match
  }

  if (!conditions.field || !conditions.operator) {
    return true; // Invalid condition structure
  }

  const fieldName = conditions.field;
  const operator = conditions.operator;
  const changedFields = activityEvent.changed_fields || {};

  // Field change operators (only work for UPDATE events)
  if (activityEvent.event_type === 'UPDATED' && changedFields[fieldName]) {
    const fieldChange = changedFields[fieldName];
    const oldValue = fieldChange.old;
    const newValue = fieldChange.new;

    switch (operator) {
      case 'field_changed':
        // Field was changed (any change)
        return true;
      
      case 'changed_from':
        // Field changed from specific value
        if (conditions.value === undefined) {
          console.warn('[activity-processor] changed_from operator requires value');
          return false;
        }
        return String(oldValue) === String(conditions.value);
      
      case 'changed_to':
        // Field changed to specific value
        if (conditions.value === undefined) {
          console.warn('[activity-processor] changed_to operator requires value');
          return false;
        }
        return String(newValue) === String(conditions.value);
      
      case 'changed_from_to':
        // Field changed from X to Y
        if (conditions.old_value === undefined || conditions.new_value === undefined) {
          console.warn('[activity-processor] changed_from_to operator requires old_value and new_value');
          return false;
        }
        return (
          String(oldValue) === String(conditions.old_value) &&
          String(newValue) === String(conditions.new_value)
        );
    }
  }

  // For field change operators on non-UPDATE events, return false
  if (['field_changed', 'changed_from', 'changed_to', 'changed_from_to'].includes(operator)) {
    return false;
  }

  // Standard condition evaluation (for CREATED events or current state checks)
  const fieldValue = entityData?.[fieldName];
  
  switch (operator) {
    case 'equals':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] equals operator requires value');
        return false;
      }
      return String(fieldValue) === String(conditions.value);
    
    case 'not_equals':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] not_equals operator requires value');
        return false;
      }
      return String(fieldValue) !== String(conditions.value);
    
    case 'contains':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] contains operator requires value');
        return false;
      }
      return String(fieldValue || '').includes(String(conditions.value));
    
    case 'not_contains':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] not_contains operator requires value');
        return false;
      }
      return !String(fieldValue || '').includes(String(conditions.value));
    
    case 'greater_than':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] greater_than operator requires value');
        return false;
      }
      return Number(fieldValue) > Number(conditions.value);
    
    case 'less_than':
      if (conditions.value === undefined) {
        console.warn('[activity-processor] less_than operator requires value');
        return false;
      }
      return Number(fieldValue) < Number(conditions.value);
    
    default:
      console.warn('[activity-processor] Unknown operator:', operator);
      return false;
  }
}

// Replace template variables with actual values
// Supports: {first_name}, {last_name}, {classes}, {sender_name}
// Variables are case-insensitive
export function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    // Use single braces {variable} format (case-insensitive)
    const placeholder = new RegExp(`\\{${key}\\}`, 'gi');
    result = result.replace(placeholder, String(value || ''));
  }
  return result;
}

// Format class name for display
export function formatClassName(classData: any, subject: any): string {
  const parts: string[] = [];
  
  if (subject?.long_name) {
    parts.push(subject.long_name);
  }
  
  if (classData.day_of_week != null) {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    parts.push(days[classData.day_of_week] || '');
  }
  
  if (classData.start_time && classData.end_time) {
    const formatTime = (time: string) => {
      const [hours, minutes] = time.split(':');
      const hour = parseInt(hours, 10);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour % 12 || 12;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    parts.push(`${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`);
  }
  
  return parts.join(' ');
}
