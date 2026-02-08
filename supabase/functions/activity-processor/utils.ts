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

// Helper function to generate a UUID v4 token
export function generateUUID(): string {
  // Generate UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const hex = '0123456789abcdef';
  let uuid = '';
  
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      uuid += hex[(Math.random() * 4 | 0 + 8)]; // Variant bits
    } else {
      uuid += hex[Math.random() * 16 | 0];
    }
  }
  
  return uuid;
}

// Helper function to build student invite URL
export function buildStudentInviteUrl(token: string, path: 'invite' | 'register' = 'invite'): string {
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development' || 
                        Deno.env.get('NODE_ENV') === 'development';
  const baseUrl = isDevelopment 
    ? 'http://localhost:3001'
    : (Deno.env.get('NEXT_PUBLIC_STUDENT_URL') || 'https://student.altitutor.com');
  return `${baseUrl}/${path}/${token}`;
}

// Helper function to build staff invite URL
export function buildStaffInviteUrl(token: string, role: string): string {
  const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development' || 
                        Deno.env.get('NODE_ENV') === 'development';
  
  if (role === 'TUTOR') {
    const baseUrl = isDevelopment 
      ? 'http://localhost:3002'
      : (Deno.env.get('NEXT_PUBLIC_TUTOR_URL') || 'https://tutor.altitutor.com');
    return `${baseUrl}/invite/${token}`;
  } else {
    const baseUrl = isDevelopment
      ? 'http://localhost:3000'
      : (Deno.env.get('NEXT_PUBLIC_ADMIN_URL') || 'https://admin.altitutor.com');
    return `${baseUrl}/invite/${token}`;
  }
}

// Helper function to generate or retrieve student invite token
export async function getOrGenerateStudentInviteToken(
  supabase: any,
  studentId: string
): Promise<string | null> {
  // Check if student exists and get invite_token
  const { data: student, error } = await supabase
    .from('students')
    .select('id, user_id, invite_token')
    .eq('id', studentId)
    .maybeSingle();
  
  if (error || !student) {
    console.warn('[activity-processor] Failed to fetch student for invite token', { studentId, error });
    return null;
  }
  
  // Don't generate invite if they already have an account
  if (student.user_id) {
    return null;
  }
  
  // Reuse existing token if available
  if (student.invite_token) {
    return student.invite_token;
  }
  
  // Generate new token
  const token = generateUUID();
  
  // Update student with invite token
  const { error: updateError } = await supabase
    .from('students')
    .update({ invite_token: token })
    .eq('id', studentId);
  
  if (updateError) {
    console.warn('[activity-processor] Failed to update student invite token', { studentId, error: updateError });
    return null;
  }
  
  return token;
}

// Helper function to generate or retrieve student registration token
export async function getOrGenerateStudentRegistrationToken(
  supabase: any,
  studentId: string
): Promise<string | null> {
  // Check if student exists and get invite_token (used for registration)
  const { data: student, error } = await supabase
    .from('students')
    .select('id, user_id, invite_token')
    .eq('id', studentId)
    .maybeSingle();
  
  if (error || !student) {
    console.warn('[activity-processor] Failed to fetch student for registration token', { studentId, error });
    return null;
  }
  
  // Registration link can be sent even if student has account but hasn't registered (status != ACTIVE)
  // But if they're fully registered (user_id exists AND status is ACTIVE), skip
  // For now, we'll allow registration link if they don't have user_id or if they have invite_token
  
  // Reuse existing token if available
  if (student.invite_token) {
    return student.invite_token;
  }
  
  // Generate new token
  const token = generateUUID();
  
  // Update student with invite token
  const { error: updateError } = await supabase
    .from('students')
    .update({ invite_token: token })
    .eq('id', studentId);
  
  if (updateError) {
    console.warn('[activity-processor] Failed to update student registration token', { studentId, error: updateError });
    return null;
  }
  
  return token;
}

// Helper function to generate or retrieve staff invite token
export async function getOrGenerateStaffInviteToken(
  supabase: any,
  staffId: string
): Promise<string | null> {
  // Check if staff exists and get invite_token and role
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id, user_id, invite_token, role')
    .eq('id', staffId)
    .maybeSingle();
  
  if (error || !staff) {
    console.warn('[activity-processor] Failed to fetch staff for invite token', { staffId, error });
    return null;
  }
  
  // Don't generate invite if they already have an account
  if (staff.user_id) {
    return null;
  }
  
  // Reuse existing token if available
  if (staff.invite_token) {
    return staff.invite_token;
  }
  
  // Generate new token
  const token = generateUUID();
  
  // Update staff with invite token
  const { error: updateError } = await supabase
    .from('staff')
    .update({ invite_token: token })
    .eq('id', staffId);
  
  if (updateError) {
    console.warn('[activity-processor] Failed to update staff invite token', { staffId, error: updateError });
    return null;
  }
  
  return token;
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
  
  // Generate invite/registration links and extract student data if student_id is available
  if (activityEvent.student_id) {
    // Load student data for first_name, last_name, classes
    const { data: student } = await supabase
      .from('students')
      .select('first_name, last_name')
      .eq('id', activityEvent.student_id)
      .maybeSingle();
    
    if (student) {
      variables['first_name'] = student.first_name || '';
      variables['last_name'] = student.last_name || '';
      
      // Load student classes for {classes} variable
      const { data: enrollments } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          classes!inner (
            id,
            day_of_week,
            start_time,
            end_time,
            room,
            level,
            subject_id,
            subjects (
              long_name,
              short_name,
              curriculum
            )
          )
        `)
        .eq('student_id', activityEvent.student_id)
        .is('unenrolled_at', null);
      
      if (enrollments && enrollments.length > 0) {
        const classesList = enrollments
          .map((e: any) => {
            const cls = e.classes;
            const subject = cls?.subjects;
            if (!cls) return null;
            
            const dayName = formatDayOfWeek(cls.day_of_week);
            const startTime = cls.start_time ? formatTime(cls.start_time) : '';
            const endTime = cls.end_time ? formatTime(cls.end_time) : '';
            const subjectName = subject?.short_name || subject?.long_name || '';
            
            return `- ${subjectName} ${dayName} ${startTime} - ${endTime}`;
          })
          .filter(Boolean)
          .join('\n');
        
        variables['classes'] = classesList || 'No classes enrolled';
      } else {
        variables['classes'] = 'No classes enrolled';
      }
    }
    
    // Student invite link
    const inviteToken = await getOrGenerateStudentInviteToken(supabase, activityEvent.student_id);
    if (inviteToken) {
      variables['student_invite_link'] = buildStudentInviteUrl(inviteToken, 'invite');
      variables['student.invite_link'] = buildStudentInviteUrl(inviteToken, 'invite'); // Also support dot notation
    } else {
      variables['student_invite_link'] = '';
      variables['student.invite_link'] = '';
    }
    
    // Student registration link
    const registrationToken = await getOrGenerateStudentRegistrationToken(supabase, activityEvent.student_id);
    if (registrationToken) {
      variables['student_registration_link'] = buildStudentInviteUrl(registrationToken, 'register');
      variables['student.registration_link'] = buildStudentInviteUrl(registrationToken, 'register'); // Also support dot notation
    } else {
      variables['student_registration_link'] = '';
      variables['student.registration_link'] = '';
    }
  }
  
  // Generate invite link for staff if staff_id is available
  if (activityEvent.staff_id) {
    // Get staff role first
    const { data: staff } = await supabase
      .from('staff')
      .select('id, role')
      .eq('id', activityEvent.staff_id)
      .maybeSingle();
    
    if (staff) {
      const inviteToken = await getOrGenerateStaffInviteToken(supabase, activityEvent.staff_id);
      if (inviteToken) {
        variables['staff_invite_link'] = buildStaffInviteUrl(inviteToken, staff.role);
        variables['staff.invite_link'] = buildStaffInviteUrl(inviteToken, staff.role); // Also support dot notation
      } else {
        variables['staff_invite_link'] = '';
        variables['staff.invite_link'] = '';
      }
    }
  }
  
  // Also check entityData for student_id/staff_id (for cases where activity event doesn't have them directly)
  if (entityData) {
    // Check for student_id in entityData (e.g., tutor_logs_student_attendance)
    if (entityData.student_id && !activityEvent.student_id) {
      const inviteToken = await getOrGenerateStudentInviteToken(supabase, entityData.student_id);
      if (inviteToken) {
        variables['student_invite_link'] = buildStudentInviteUrl(inviteToken, 'invite');
        variables['student.invite_link'] = buildStudentInviteUrl(inviteToken, 'invite');
      }
      
      const registrationToken = await getOrGenerateStudentRegistrationToken(supabase, entityData.student_id);
      if (registrationToken) {
        variables['student_registration_link'] = buildStudentInviteUrl(registrationToken, 'register');
        variables['student.registration_link'] = buildStudentInviteUrl(registrationToken, 'register');
      }
    }
    
    // Check for staff_id in entityData
    if (entityData.staff_id && !activityEvent.staff_id) {
      const { data: staff } = await supabase
        .from('staff')
        .select('id, role')
        .eq('id', entityData.staff_id)
        .maybeSingle();
      
      if (staff) {
        const inviteToken = await getOrGenerateStaffInviteToken(supabase, entityData.staff_id);
        if (inviteToken) {
          variables['staff_invite_link'] = buildStaffInviteUrl(inviteToken, staff.role);
          variables['staff.invite_link'] = buildStaffInviteUrl(inviteToken, staff.role);
        }
      }
    }
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
      
      // Generate booking confirmation link for trial sessions
      if (sessionData.type === 'TRIAL_SESSION' && sessionData.id) {
        // Determine base URL (use environment variable or default to production)
        const studentUrl = Deno.env.get('NEXT_PUBLIC_STUDENT_URL') || 'https://student.altitutor.com';
        const bookingConfirmationUrl = `${studentUrl}/booking-success?sessionId=${sessionData.id}`;
        variables['booking_confirmation_link'] = bookingConfirmationUrl;
        variables['booking_confirmation_url'] = bookingConfirmationUrl;
        variables['session.booking_confirmation_link'] = bookingConfirmationUrl;
        variables['session.booking_confirmation_url'] = bookingConfirmationUrl;
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
  
  // Extract common entity fields (always available from activity event)
  variables['entity_type'] = activityEvent.entity_type || '';
  variables['entity_id'] = activityEvent.entity_id || '';
  
  // Extract entity data fields (if entityData is provided)
  if (entityData) {
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
