import type { SupabaseClient } from '@supabase/supabase-js';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Activity event structure from database
 */
export interface ActivityEvent {
  id: string;
  entity_type: string;
  entity_id: string;
  event_type: string;
  class_id?: string | null;
  session_id?: string | null;
  student_id?: string | null;
  staff_id?: string | null;
  task_id?: string | null;
  parent_id?: string | null;
  performed_by?: string | null;
  changed_fields?: Record<string, { old: unknown; new: unknown }> | null;
  metadata?: Record<string, unknown> | null;
}

/**
 * Notification recipient object
 */
type NotificationRecipient = { staff_id?: string; student_id?: string };

/**
 * Resolver function type for notification recipients
 */
type NotificationRecipientResolver = (
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
) => Promise<NotificationRecipient[]>;

/**
 * Resolve all students enrolled in a class
 */
async function resolveClassStudents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.class_id) {
    throw new Error('class_id required for class_students recipient type');
  }
  
  const { data: enrollments } = await supabase
    .from('classes_students')
    .select('student_id')
    .eq('class_id', activityEvent.class_id)
    .is('unenrolled_at', null);
  
  if (!enrollments) return [];
  
  return enrollments.map((e: any) => ({ student_id: e.student_id }));
}

/**
 * Resolve all staff assigned to a class
 */
async function resolveClassStaff(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.class_id) {
    throw new Error('class_id required for class_staff recipient type');
  }
  
  const { data: classStaff } = await supabase
    .from('classes_staff')
    .select('staff_id')
    .eq('class_id', activityEvent.class_id)
    .is('unassigned_at', null);
  
  if (!classStaff) return [];
  
  return classStaff.map((cs: any) => ({ staff_id: cs.staff_id }));
}

/**
 * Resolve all students and staff in a class
 */
async function resolveClassAll(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.class_id) {
    throw new Error('class_id required for class_all recipient type');
  }
  
  const recipients: NotificationRecipient[] = [];
  
  // Get students
  const students = await resolveClassStudents(supabase, activityEvent);
  recipients.push(...students);
  
  // Get staff
  const staff = await resolveClassStaff(supabase, activityEvent);
  recipients.push(...staff);
  
  return recipients;
}

/**
 * Resolve all students enrolled in a session
 */
async function resolveSessionStudents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.session_id) {
    throw new Error('session_id required for session_students recipient type');
  }
  
  const { data: sessionStudents } = await supabase
    .from('sessions_students')
    .select('student_id')
    .eq('session_id', activityEvent.session_id);
  
  if (!sessionStudents) return [];
  
  return sessionStudents.map((ss: any) => ({ student_id: ss.student_id }));
}

/**
 * Resolve all staff assigned to a session
 */
async function resolveSessionStaff(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.session_id) {
    throw new Error('session_id required for session_staff recipient type');
  }
  
  const { data: sessionStaff } = await supabase
    .from('sessions_staff')
    .select('staff_id')
    .eq('session_id', activityEvent.session_id);
  
  if (!sessionStaff) return [];
  
  return sessionStaff.map((ss: any) => ({ staff_id: ss.staff_id }));
}

/**
 * Resolve all students and staff in a session
 */
async function resolveSessionAll(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.session_id) {
    throw new Error('session_id required for session_all recipient type');
  }
  
  const recipients: NotificationRecipient[] = [];
  
  // Get students
  const students = await resolveSessionStudents(supabase, activityEvent);
  recipients.push(...students);
  
  // Get staff
  const staff = await resolveSessionStaff(supabase, activityEvent);
  recipients.push(...staff);
  
  return recipients;
}

/**
 * Resolve all admin staff (staff with role = 'ADMINSTAFF' and status = 'ACTIVE')
 */
async function resolveAllAdminStaff(
  supabase: SupabaseClient<unknown>,
  _activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id')
    .eq('role', 'ADMINSTAFF')
    .eq('status', 'ACTIVE');
  
  if (error) {
    throw new Error(`Failed to fetch admin staff: ${error.message}`);
  }
  
  if (!staff) return [];
  
  return staff.map((s) => ({ staff_id: s.id }));
}

/**
 * Resolve all staff (all active staff members regardless of role)
 */
async function resolveAllStaff(
  supabase: SupabaseClient<unknown>,
  _activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  const { data: staff, error } = await supabase
    .from('staff')
    .select('id')
    .eq('status', 'ACTIVE');
  
  if (error) {
    throw new Error(`Failed to fetch staff: ${error.message}`);
  }
  
  if (!staff) return [];
  
  return staff.map((s) => ({ staff_id: s.id }));
}

/**
 * Resolve admin staff who work on a specific day
 * Determines the day from class_id (classes.day_of_week) or session_id (sessions.start_at)
 */
async function resolveAdminStaffOnDay(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  let dayOfWeek: number | null = null;
  
  // Try to get day from class_id
  if (activityEvent.class_id) {
    const { data: classData, error: classError } = await supabase
      .from('classes')
      .select('day_of_week')
      .eq('id', activityEvent.class_id)
      .maybeSingle();
    
    if (classError) {
      throw new Error(`Failed to fetch class: ${classError.message}`);
    }
    
    if (classData && classData.day_of_week !== null && classData.day_of_week !== undefined) {
      dayOfWeek = classData.day_of_week;
    }
  }
  
  // If no class_id or day_of_week not found, try session_id
  if (dayOfWeek === null && activityEvent.session_id) {
    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('start_at')
      .eq('id', activityEvent.session_id)
      .maybeSingle();
    
    if (sessionError) {
      throw new Error(`Failed to fetch session: ${sessionError.message}`);
    }
    
    if (sessionData?.start_at) {
      // Extract day of week from timestamp in Adelaide timezone
      // Sessions are stored in UTC, but we need the day of week in Adelaide timezone
      const startAt = new Date(sessionData.start_at);
      
      // Use Intl.DateTimeFormat to get date components in Adelaide timezone
      const formatter = new Intl.DateTimeFormat('en', {
        timeZone: 'Australia/Adelaide',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
      
      const parts = formatter.formatToParts(startAt);
      const year = parseInt(parts.find((p) => p.type === 'year')?.value || '0', 10);
      const month = parseInt(parts.find((p) => p.type === 'month')?.value || '0', 10) - 1; // 0-indexed
      const day = parseInt(parts.find((p) => p.type === 'day')?.value || '0', 10);
      
      // Create a date object at midnight in local time (represents the Adelaide date)
      // This gives us the correct day of week (0=Sunday, 6=Saturday)
      const adelaideDate = new Date(year, month, day);
      dayOfWeek = adelaideDate.getDay();
    }
  }
  
  if (dayOfWeek === null) {
    throw new Error('admin_staff_on_day requires class_id or session_id in activity event');
  }
  
  // Query admin_shifts for shifts on this day
  const { data: adminShifts, error: shiftsError } = await supabase
    .from('admin_shifts')
    .select('id')
    .eq('day_of_week', dayOfWeek)
    .eq('status', 'ACTIVE');
  
  if (shiftsError) {
    throw new Error(`Failed to fetch admin shifts: ${shiftsError.message}`);
  }
  
  if (!adminShifts || adminShifts.length === 0) return [];
  
  const adminShiftIds = adminShifts.map((shift) => shift.id);
  
  // Query admin_shifts_staff for staff assigned to these shifts
  const { data: adminShiftStaff, error: shiftError } = await supabase
    .from('admin_shifts_staff')
    .select('staff_id')
    .in('admin_shift_id', adminShiftIds)
    .is('unassigned_at', null);
  
  if (shiftError) {
    throw new Error(`Failed to fetch admin shift staff: ${shiftError.message}`);
  }
  
  if (!adminShiftStaff || adminShiftStaff.length === 0) return [];
  
  // Get unique staff IDs
  const staffIds = [...new Set(adminShiftStaff.map((ass) => ass.staff_id))];
  
  // Verify these staff are actually ADMINSTAFF and ACTIVE
  const { data: staff, error: staffError } = await supabase
    .from('staff')
    .select('id')
    .in('id', staffIds)
    .eq('role', 'ADMINSTAFF')
    .eq('status', 'ACTIVE');
  
  if (staffError) {
    throw new Error(`Failed to verify admin staff: ${staffError.message}`);
  }
  
  if (!staff) return [];
  
  return staff.map((s) => ({ staff_id: s.id }));
}

/**
 * Resolve all staff assigned to a tutor log
 * Uses entity_id (tutor_log_id) from activity event
 */
async function resolveTutorLogStaff(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  if (!activityEvent.entity_id) {
    throw new Error('entity_id (tutor_log_id) required for tutor_log_staff recipient type');
  }
  
  const { data: staffAttendance } = await supabase
    .from('tutor_logs_staff_attendance')
    .select('staff_id')
    .eq('tutor_log_id', activityEvent.entity_id);
  
  if (!staffAttendance) return [];
  
  return staffAttendance.map((sa: any) => ({ staff_id: sa.staff_id }));
}

/**
 * Resolve single recipient - handled by caller, returns empty array
 */
async function resolveSingle(
  _supabase: SupabaseClient<unknown>,
  _activityEvent: ActivityEvent
): Promise<NotificationRecipient[]> {
  // Single recipient is handled by the caller (backward compatibility)
  return [];
}

// ============================================================================
// NOTIFICATION RECIPIENT REGISTRY
// ============================================================================
// To add a new notification recipient type:
// 1. Create a resolver function above (e.g., resolveAllAdminStaff)
// 2. Add it to this registry object
// 3. Update the TypeScript types in apps/admin-web/src/features/automation/types/index.ts

const notificationRecipientResolvers: Record<string, NotificationRecipientResolver> = {
  'single': resolveSingle,
  'class_students': resolveClassStudents,
  'class_staff': resolveClassStaff,
  'class_all': resolveClassAll,
  'session_students': resolveSessionStudents,
  'session_staff': resolveSessionStaff,
  'session_all': resolveSessionAll,
  'all_admin_staff': resolveAllAdminStaff,
  'all_staff': resolveAllStaff,
  'admin_staff_on_day': resolveAdminStaffOnDay,
  'tutor_log_staff': resolveTutorLogStaff,
};

/**
 * Main function to resolve notification recipients based on recipient type
 * Uses the registry pattern for easy extensibility
 */
export async function resolveNotificationRecipients(
  supabase: SupabaseClient<unknown>,
  recipientType: string,
  activityEvent: ActivityEvent
): Promise<Array<{ staff_id?: string; student_id?: string }>> {
  const resolver = notificationRecipientResolvers[recipientType];
  
  if (!resolver) {
    throw new Error(`Unknown recipient type: ${recipientType}. Available types: ${Object.keys(notificationRecipientResolvers).join(', ')}`);
  }
  
  return resolver(supabase, activityEvent);
}

// ============================================================================
// MESSAGE RECIPIENT RESOLVERS (CONTACTS)
// ============================================================================
// Each resolver function takes supabase client and activity event,
// and returns an array of contact IDs (strings)

/**
 * Resolver function type for message recipients (contacts)
 */
type MessageRecipientResolver = (
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
) => Promise<string[]>;

/**
 * Helper: Get contact IDs for student IDs
 */
async function getStudentContactIds(
  supabase: SupabaseClient<unknown>,
  studentIds: string[]
): Promise<string[]> {
  if (studentIds.length === 0) return [];
  
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .in('student_id', studentIds)
    .eq('contact_type', 'STUDENT')
    .eq('is_opted_out', false);
  
  if (!contacts) return [];
  
  return contacts.map((c: any) => c.id);
}

/**
 * Helper: Get contact IDs for parent IDs
 */
async function getParentContactIds(
  supabase: SupabaseClient<unknown>,
  parentIds: string[]
): Promise<string[]> {
  if (parentIds.length === 0) return [];
  
  const { data: contacts } = await supabase
    .from('contacts')
    .select('id')
    .in('parent_id', parentIds)
    .eq('contact_type', 'PARENT')
    .eq('is_opted_out', false);
  
  if (!contacts) return [];
  
  return contacts.map((c: any) => c.id);
}

/**
 * Resolve contact IDs for all students enrolled in a class
 */
async function resolveMessageClassStudents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.class_id) {
    throw new Error('class_id required for class_students recipient type');
  }
  
  const { data: enrollments } = await supabase
    .from('classes_students')
    .select('student_id')
    .eq('class_id', activityEvent.class_id)
    .is('unenrolled_at', null);
  
  if (!enrollments || enrollments.length === 0) return [];
  
  const studentIds = enrollments.map((e: any) => e.student_id);
  return getStudentContactIds(supabase, studentIds);
}

/**
 * Resolve contact IDs for all students and their parents in a class
 */
async function resolveMessageClassStudentsAndParents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.class_id) {
    throw new Error('class_id required for class_students_and_parents recipient type');
  }
  
  const { data: enrollments } = await supabase
    .from('classes_students')
    .select('student_id')
    .eq('class_id', activityEvent.class_id)
    .is('unenrolled_at', null);
  
  if (!enrollments || enrollments.length === 0) return [];
  
  const studentIds = enrollments.map((e: any) => e.student_id);
  const contactIds: string[] = [];
  
  // Get student contacts
  const studentContacts = await getStudentContactIds(supabase, studentIds);
  contactIds.push(...studentContacts);
  
  // Get parent contacts via parents_students
  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent_id')
    .in('student_id', studentIds);
  
  if (parentLinks && parentLinks.length > 0) {
    const parentIds = parentLinks.map((pl: any) => pl.parent_id);
    const parentContacts = await getParentContactIds(supabase, parentIds);
    contactIds.push(...parentContacts);
  }
  
  // Deduplicate
  return [...new Set(contactIds)];
}

/**
 * Resolve contact IDs for all students enrolled in a session
 */
async function resolveMessageSessionStudents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.session_id) {
    throw new Error('session_id required for session_students recipient type');
  }
  
  const { data: sessionStudents } = await supabase
    .from('sessions_students')
    .select('student_id')
    .eq('session_id', activityEvent.session_id);
  
  if (!sessionStudents || sessionStudents.length === 0) return [];
  
  const studentIds = sessionStudents.map((ss: any) => ss.student_id);
  return getStudentContactIds(supabase, studentIds);
}

/**
 * Resolve contact IDs for all students and their parents in a session
 */
async function resolveMessageSessionStudentsAndParents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.session_id) {
    throw new Error('session_id required for session_students_and_parents recipient type');
  }
  
  const { data: sessionStudents } = await supabase
    .from('sessions_students')
    .select('student_id')
    .eq('session_id', activityEvent.session_id);
  
  if (!sessionStudents || sessionStudents.length === 0) return [];
  
  const studentIds = sessionStudents.map((ss: any) => ss.student_id);
  const contactIds: string[] = [];
  
  // Get student contacts
  const studentContacts = await getStudentContactIds(supabase, studentIds);
  contactIds.push(...studentContacts);
  
  // Get parent contacts via parents_students
  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent_id')
    .in('student_id', studentIds);
  
  if (parentLinks && parentLinks.length > 0) {
    const parentIds = parentLinks.map((pl: any) => pl.parent_id);
    const parentContacts = await getParentContactIds(supabase, parentIds);
    contactIds.push(...parentContacts);
  }
  
  // Deduplicate
  return [...new Set(contactIds)];
}

/**
 * Resolve contact IDs for a single student and all their parents
 * Uses student_id from activity event
 */
async function resolveMessageStudentAndParents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.student_id) {
    throw new Error('student_id required for student_and_parents recipient type');
  }
  
  const contactIds: string[] = [];
  
  // Get student contact
  const studentContacts = await getStudentContactIds(supabase, [activityEvent.student_id]);
  contactIds.push(...studentContacts);
  
  // Get parent contacts via parents_students
  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent_id')
    .eq('student_id', activityEvent.student_id);
  
  if (parentLinks && parentLinks.length > 0) {
    const parentIds = parentLinks.map((pl: any) => pl.parent_id);
    const parentContacts = await getParentContactIds(supabase, parentIds);
    contactIds.push(...parentContacts);
  }
  
  // Deduplicate
  return [...new Set(contactIds)];
}

/**
 * Resolve contact IDs for all students in a tutor log's student attendance
 * Uses entity_id (tutor_log_id) from activity event
 */
async function resolveMessageTutorLogStudents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.entity_id) {
    throw new Error('entity_id (tutor_log_id) required for tutor_log_students recipient type');
  }
  
  const { data: studentAttendance } = await supabase
    .from('tutor_logs_student_attendance')
    .select('student_id')
    .eq('tutor_log_id', activityEvent.entity_id);
  
  if (!studentAttendance || studentAttendance.length === 0) return [];
  
  const studentIds = studentAttendance.map((sa: any) => sa.student_id);
  return getStudentContactIds(supabase, studentIds);
}

/**
 * Resolve contact IDs for all students and their parents in a tutor log's student attendance
 * Uses entity_id (tutor_log_id) from activity event
 */
async function resolveMessageTutorLogStudentsAndParents(
  supabase: SupabaseClient<unknown>,
  activityEvent: ActivityEvent
): Promise<string[]> {
  if (!activityEvent.entity_id) {
    throw new Error('entity_id (tutor_log_id) required for tutor_log_students_and_parents recipient type');
  }
  
  const { data: studentAttendance } = await supabase
    .from('tutor_logs_student_attendance')
    .select('student_id')
    .eq('tutor_log_id', activityEvent.entity_id);
  
  if (!studentAttendance || studentAttendance.length === 0) return [];
  
  const studentIds = studentAttendance.map((sa: any) => sa.student_id);
  const contactIds: string[] = [];
  
  // Get student contacts
  const studentContacts = await getStudentContactIds(supabase, studentIds);
  contactIds.push(...studentContacts);
  
  // Get parent contacts via parents_students
  const { data: parentLinks } = await supabase
    .from('parents_students')
    .select('parent_id')
    .in('student_id', studentIds);
  
  if (parentLinks && parentLinks.length > 0) {
    const parentIds = parentLinks.map((pl: any) => pl.parent_id);
    const parentContacts = await getParentContactIds(supabase, parentIds);
    contactIds.push(...parentContacts);
  }
  
  // Deduplicate
  return [...new Set(contactIds)];
}

/**
 * Resolve single recipient - handled by caller, returns empty array
 */
async function resolveMessageSingle(
  _supabase: SupabaseClient<unknown>,
  _activityEvent: ActivityEvent
): Promise<string[]> {
  // Single recipient is handled by the caller (backward compatibility)
  return [];
}

// ============================================================================
// MESSAGE RECIPIENT REGISTRY
// ============================================================================
// To add a new message recipient type:
// 1. Create a resolver function above (e.g., resolveMessageAllAdminStaff)
// 2. Add it to this registry object
// 3. Update the TypeScript types in apps/admin-web/src/features/automation/types/index.ts

const messageRecipientResolvers: Record<string, MessageRecipientResolver> = {
  'single': resolveMessageSingle,
  'class_students': resolveMessageClassStudents,
  'class_students_and_parents': resolveMessageClassStudentsAndParents,
  'session_students': resolveMessageSessionStudents,
  'session_students_and_parents': resolveMessageSessionStudentsAndParents,
  'student_and_parents': resolveMessageStudentAndParents,
  'tutor_log_students': resolveMessageTutorLogStudents,
  'tutor_log_students_and_parents': resolveMessageTutorLogStudentsAndParents,
  // Future recipient types can be added here:
  // 'all_admin_staff': resolveMessageAllAdminStaff,
  // 'all_staff': resolveMessageAllStaff,
};

/**
 * Main function to resolve message recipients (contacts) based on recipient type
 * Uses the registry pattern for easy extensibility
 */
export async function resolveMessageRecipients(
  supabase: SupabaseClient<unknown>,
  recipientType: string,
  activityEvent: ActivityEvent
): Promise<string[]> {
  const resolver = messageRecipientResolvers[recipientType];
  
  if (!resolver) {
    throw new Error(`Unknown recipient type: ${recipientType}. Available types: ${Object.keys(messageRecipientResolvers).join(', ')}`);
  }
  
  return resolver(supabase, activityEvent);
}
