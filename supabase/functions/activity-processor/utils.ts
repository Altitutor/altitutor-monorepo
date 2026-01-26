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
  // Convert literal \n sequences to actual newlines
  // This handles templates stored with escaped newlines in the database
  result = result.replace(/\\n/g, '\n');
  return result;
}

// Format time string (HH:MM:SS or HH:MM) to 12-hour format
export function formatTime(time: string): string {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

// Format day of week (0-6) to short name
export function formatDayOfWeek(dayOfWeek: number | null | undefined): string {
  if (dayOfWeek == null) return '';
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[dayOfWeek] || '';
}

// Format timestamp to date string
export function formatDate(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch {
    return '';
  }
}

// Format timestamp to time string
export function formatDateTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch {
    return '';
  }
}

// Format class name for display
export function formatClassName(classData: any, subject: any): string {
  const parts: string[] = [];
  
  if (subject?.long_name) {
    parts.push(subject.long_name);
  }
  
  if (classData.day_of_week != null) {
    parts.push(formatDayOfWeek(classData.day_of_week));
  }
  
  if (classData.start_time && classData.end_time) {
    parts.push(`${formatTime(classData.start_time)} - ${formatTime(classData.end_time)}`);
  }
  
  return parts.join(' ');
}

// Format session date/time as "ddd, dd-mmm hh:mm" (e.g., "Mon, 15-Jan 2:30 PM")
export function formatSessionDateTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    if (isNaN(date.getTime())) return '';
    
    // Format in Adelaide timezone
    const formatter = new Intl.DateTimeFormat('en', {
      timeZone: 'Australia/Adelaide',
      weekday: 'short',      // "Mon"
      day: '2-digit',        // "15"
      month: 'short',         // "Jan"
      hour: 'numeric',       // "2"
      minute: '2-digit',     // "30"
      hour12: true,          // AM/PM
    });
    
    const parts = formatter.formatToParts(date);
    const weekday = parts.find((p) => p.type === 'weekday')?.value || '';
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '';
    const minute = parts.find((p) => p.type === 'minute')?.value || '';
    const dayPeriod = parts.find((p) => p.type === 'dayPeriod')?.value || '';
    
    return `${weekday}, ${day}-${month} ${hour}:${minute} ${dayPeriod.toUpperCase()}`;
  } catch {
    return '';
  }
}

// Format entity name based on entity type
export async function formatEntityName(
  supabase: any,
  entityType: string,
  entityData: any,
  activityEvent: any
): Promise<string> {
  if (!entityData) return '';
  
  switch (entityType) {
    case 'students': {
      const firstName = entityData.first_name || '';
      const lastName = entityData.last_name || '';
      return `${firstName} ${lastName}`.trim() || `Student ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'staff': {
      const firstName = entityData.first_name || '';
      const lastName = entityData.last_name || '';
      return `${firstName} ${lastName}`.trim() || `Staff ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'parents': {
      const firstName = entityData.first_name || '';
      const lastName = entityData.last_name || '';
      return `${firstName} ${lastName}`.trim() || `Parent ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'tasks': {
      return entityData.title || `Task ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'sessions': {
      // Format: {sessions.subjects.short_name} {sessions.type} {sessions.start_at (in format ddd, dd-mmm hh:mm)}
      const parts: string[] = [];
      
      // Get subject short_name (check both class_id and direct subject_id)
      let subjectShortName: string | null = null;
      
      if (entityData.class_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('subject_id')
          .eq('id', entityData.class_id)
          .maybeSingle();
        
        if (classData?.subject_id) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('short_name')
            .eq('id', classData.subject_id)
            .maybeSingle();
          
          subjectShortName = subjectData?.short_name || null;
        }
      } else if (entityData.subject_id) {
        // Some sessions might have direct subject_id
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('short_name')
          .eq('id', entityData.subject_id)
          .maybeSingle();
        
        subjectShortName = subjectData?.short_name || null;
      }
      
      if (subjectShortName) {
        parts.push(subjectShortName);
      }
      
      // Add session type
      if (entityData.type) {
        parts.push(entityData.type);
      }
      
      // Add formatted start_at (ddd, dd-mmm hh:mm format)
      if (entityData.start_at) {
        const formattedDateTime = formatSessionDateTime(entityData.start_at);
        if (formattedDateTime) {
          parts.push(formattedDateTime);
        }
      }
      
      return parts.join(' ') || `Session ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'classes': {
      // Format: {classes.subjects.short_name} {classes.day (in ddd format)} {classes.start_time}
      const parts: string[] = [];
      
      // Get subject short_name
      if (entityData.subject_id) {
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('short_name')
          .eq('id', entityData.subject_id)
          .maybeSingle();
        
        if (subjectData?.short_name) {
          parts.push(subjectData.short_name);
        }
      }
      
      // Add day of week (ddd format)
      if (entityData.day_of_week != null) {
        const dayName = formatDayOfWeek(entityData.day_of_week);
        if (dayName) {
          parts.push(dayName);
        }
      }
      
      // Add start_time (formatted as hh:mm AM/PM)
      if (entityData.start_time) {
        const formattedTime = formatTime(entityData.start_time);
        if (formattedTime) {
          parts.push(formattedTime);
        }
      }
      
      return parts.join(' ') || `Class ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    case 'tutor_logs': {
      // Format: the linked session name (format like sessions)
      if (entityData.session_id) {
        const { data: sessionData } = await supabase
          .from('sessions')
          .select('*, class_id')
          .eq('id', entityData.session_id)
          .maybeSingle();
        
        if (sessionData) {
          return await formatEntityName(supabase, 'sessions', sessionData, activityEvent);
        }
      }
      return `Tutor Log ${entityData.id?.slice(0, 8) || ''}`;
    }
    
    default:
      return `Entity ${entityData.id?.slice(0, 8) || ''}`;
  }
}

// Extract template variables from activity event and related entities
export async function extractTemplateVariables(
  supabase: any,
  activityEvent: any,
  entityData: any
): Promise<Record<string, any>> {
  const variables: Record<string, any> = {};
  
  // Load sender name from performed_by staff
  if (activityEvent.performed_by) {
    const { data: staff } = await supabase
      .from('staff')
      .select('first_name, last_name')
      .eq('id', activityEvent.performed_by)
      .maybeSingle();
    
    if (staff) {
      const senderName = `${staff.first_name || ''} ${staff.last_name || ''}`.trim();
      variables.sender_name = senderName || 'System';
    } else {
      variables.sender_name = 'System';
    }
  } else {
    // If no performed_by, default to "System"
    variables.sender_name = 'System';
  }
  
  // Load class data if class_id is available
  if (activityEvent.class_id) {
    // First get the class
    const { data: classData } = await supabase
      .from('classes')
      .select('*')
      .eq('id', activityEvent.class_id)
      .maybeSingle();
    
    if (classData && classData.subject_id) {
      // Then get the subject
      const { data: subjectData } = await supabase
        .from('subjects')
        .select('long_name, short_name')
        .eq('id', classData.subject_id)
        .maybeSingle();
      
      // Class fields
      variables['class.subject.long_name'] = subjectData?.long_name || '';
      variables['class.subject.short_name'] = subjectData?.short_name || '';
      variables['class.day_of_week'] = formatDayOfWeek(classData.day_of_week);
      variables['class.start_time'] = classData.start_time ? formatTime(classData.start_time) : '';
      variables['class.end_time'] = classData.end_time ? formatTime(classData.end_time) : '';
      variables['class.room'] = classData.room || '';
      variables['class.level'] = classData.level || '';
      
      // Also support without "class." prefix for backward compatibility
      variables['classes.subject.long_name'] = subjectData?.long_name || '';
      variables['classes.subject.short_name'] = subjectData?.short_name || '';
      variables['classes.day_of_week'] = formatDayOfWeek(classData.day_of_week);
      variables['classes.start_time'] = classData.start_time ? formatTime(classData.start_time) : '';
      variables['classes.end_time'] = classData.end_time ? formatTime(classData.end_time) : '';
      variables['classes.room'] = classData.room || '';
      variables['classes.level'] = classData.level || '';
    }
  }
  
  // Load session data if session_id is available
  if (activityEvent.session_id) {
    // First get the session
    const { data: sessionData } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', activityEvent.session_id)
      .maybeSingle();
    
    if (sessionData) {
      // Session fields
      variables['session.type'] = sessionData.type || '';
      variables['session.start_at'] = sessionData.start_at ? formatDateTime(sessionData.start_at) : '';
      variables['session.end_at'] = sessionData.end_at ? formatDateTime(sessionData.end_at) : '';
      
      // Also support without "session." prefix for backward compatibility
      variables['sessions.type'] = sessionData.type || '';
      variables['sessions.start_at'] = sessionData.start_at ? formatDateTime(sessionData.start_at) : '';
      variables['sessions.end_at'] = sessionData.end_at ? formatDateTime(sessionData.end_at) : '';
      
      // Get subject from class if class_id is available
      if (sessionData.class_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('subject_id')
          .eq('id', sessionData.class_id)
          .maybeSingle();
        
        if (classData && classData.subject_id) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('long_name, short_name')
            .eq('id', classData.subject_id)
            .maybeSingle();
          
          if (subjectData) {
            variables['session.subject.long_name'] = subjectData.long_name || '';
            variables['session.subject.short_name'] = subjectData.short_name || '';
            variables['sessions.subject.long_name'] = subjectData.long_name || '';
            variables['sessions.subject.short_name'] = subjectData.short_name || '';
          }
        }
      }
      
      // Also check if session has direct subject_id
      if (sessionData.subject_id) {
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('long_name, short_name')
          .eq('id', sessionData.subject_id)
          .maybeSingle();
        
        if (subjectData) {
          variables['session.subject.long_name'] = subjectData.long_name || '';
          variables['session.subject.short_name'] = subjectData.short_name || '';
          variables['sessions.subject.long_name'] = subjectData.long_name || '';
          variables['sessions.subject.short_name'] = subjectData.short_name || '';
        }
      }
    }
  }
  
  // Extract changed fields (for UPDATE events)
  if (activityEvent.event_type === 'UPDATED' && activityEvent.changed_fields) {
    const changedFields = activityEvent.changed_fields;
    const fieldNames = Object.keys(changedFields);
    
    if (fieldNames.length > 0) {
      // First changed field (most common use case)
      const firstFieldName = fieldNames[0];
      const firstFieldChange = changedFields[firstFieldName];
      
      variables['changed_field'] = firstFieldName;
      variables['changed_field_name'] = firstFieldName;
      variables['old_value'] = firstFieldChange?.old != null ? String(firstFieldChange.old) : '';
      variables['new_value'] = firstFieldChange?.new != null ? String(firstFieldChange.new) : '';
      
      // Also add variables for each changed field
      for (const fieldName of fieldNames) {
        const fieldChange = changedFields[fieldName];
        const safeFieldName = fieldName.replace(/[^a-zA-Z0-9_]/g, '_'); // Sanitize for variable name
        
        variables[`changed_field.${safeFieldName}.name`] = fieldName;
        variables[`changed_field.${safeFieldName}.old_value`] = fieldChange?.old != null ? String(fieldChange.old) : '';
        variables[`changed_field.${safeFieldName}.new_value`] = fieldChange?.new != null ? String(fieldChange.new) : '';
      }
    }
  }
  
  // Extract entity data fields (if entityData is provided)
  if (entityData) {
    // Add common entity fields
    variables['entity_type'] = activityEvent.entity_type || '';
    variables['entity_id'] = activityEvent.entity_id || '';
    
    // Add specific fields based on entity type
    // For classes
    if (activityEvent.entity_type === 'classes' && entityData) {
      variables['entity.day_of_week'] = formatDayOfWeek(entityData.day_of_week);
      variables['entity.start_time'] = entityData.start_time ? formatTime(entityData.start_time) : '';
      variables['entity.end_time'] = entityData.end_time ? formatTime(entityData.end_time) : '';
      variables['entity.room'] = entityData.room || '';
      variables['entity.level'] = entityData.level || '';
      
      // Load subject if subject_id is available
      if (entityData.subject_id) {
        const { data: subjectData } = await supabase
          .from('subjects')
          .select('long_name, short_name')
          .eq('id', entityData.subject_id)
          .maybeSingle();
        
        if (subjectData) {
          variables['entity.subject.long_name'] = subjectData.long_name || '';
          variables['entity.subject.short_name'] = subjectData.short_name || '';
        }
      }
    }
    
    // For sessions
    if (activityEvent.entity_type === 'sessions' && entityData) {
      variables['entity.type'] = entityData.type || '';
      variables['entity.start_at'] = entityData.start_at ? formatDateTime(entityData.start_at) : '';
      variables['entity.end_at'] = entityData.end_at ? formatDateTime(entityData.end_at) : '';
      
      // Load subject from class if class_id is available
      if (entityData.class_id) {
        const { data: classData } = await supabase
          .from('classes')
          .select('subject_id')
          .eq('id', entityData.class_id)
          .maybeSingle();
        
        if (classData && classData.subject_id) {
          const { data: subjectData } = await supabase
            .from('subjects')
            .select('long_name, short_name')
            .eq('id', classData.subject_id)
            .maybeSingle();
          
          if (subjectData) {
            variables['entity.subject.long_name'] = subjectData.long_name || '';
            variables['entity.subject.short_name'] = subjectData.short_name || '';
          }
        }
      }
    }
    
    // Add entity_name variable (formatted display name for the entity)
    try {
      const entityName = await formatEntityName(
        supabase,
        activityEvent.entity_type || '',
        entityData,
        activityEvent
      );
      variables['entity_name'] = entityName;
    } catch (error) {
      console.warn('[activity-processor] Failed to format entity_name', error);
      variables['entity_name'] = '';
    }
  }
  
  return variables;
}
