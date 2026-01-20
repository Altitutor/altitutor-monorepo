// @ts-nocheck
// deno-lint-ignore-file no-explicit-any

// Helper function to resolve notification recipients based on recipient type
export async function resolveNotificationRecipients(
  supabase: any,
  recipientType: string,
  activityEvent: any
): Promise<Array<{ staff_id?: string; student_id?: string }>> {
  const recipients: Array<{ staff_id?: string; student_id?: string }> = [];

  switch (recipientType) {
    case 'class_students': {
      if (!activityEvent.class_id) {
        throw new Error('class_id required for class_students recipient type');
      }
      const { data: enrollments } = await supabase
        .from('classes_students')
        .select('student_id')
        .eq('class_id', activityEvent.class_id)
        .is('unenrolled_at', null);
      
      if (enrollments) {
        recipients.push(...enrollments.map((e: any) => ({ student_id: e.student_id })));
      }
      break;
    }

    case 'class_staff': {
      if (!activityEvent.class_id) {
        throw new Error('class_id required for class_staff recipient type');
      }
      const { data: classStaff } = await supabase
        .from('classes_staff')
        .select('staff_id')
        .eq('class_id', activityEvent.class_id)
        .is('unassigned_at', null);
      
      if (classStaff) {
        recipients.push(...classStaff.map((cs: any) => ({ staff_id: cs.staff_id })));
      }
      break;
    }

    case 'class_all': {
      if (!activityEvent.class_id) {
        throw new Error('class_id required for class_all recipient type');
      }
      // Get students
      const { data: enrollments } = await supabase
        .from('classes_students')
        .select('student_id')
        .eq('class_id', activityEvent.class_id)
        .is('unenrolled_at', null);
      
      if (enrollments) {
        recipients.push(...enrollments.map((e: any) => ({ student_id: e.student_id })));
      }
      
      // Get staff
      const { data: classStaff } = await supabase
        .from('classes_staff')
        .select('staff_id')
        .eq('class_id', activityEvent.class_id)
        .is('unassigned_at', null);
      
      if (classStaff) {
        recipients.push(...classStaff.map((cs: any) => ({ staff_id: cs.staff_id })));
      }
      break;
    }

    case 'session_students': {
      if (!activityEvent.session_id) {
        throw new Error('session_id required for session_students recipient type');
      }
      const { data: sessionStudents } = await supabase
        .from('sessions_students')
        .select('student_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStudents) {
        recipients.push(...sessionStudents.map((ss: any) => ({ student_id: ss.student_id })));
      }
      break;
    }

    case 'session_staff': {
      if (!activityEvent.session_id) {
        throw new Error('session_id required for session_staff recipient type');
      }
      const { data: sessionStaff } = await supabase
        .from('sessions_staff')
        .select('staff_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStaff) {
        recipients.push(...sessionStaff.map((ss: any) => ({ staff_id: ss.staff_id })));
      }
      break;
    }

    case 'session_all': {
      if (!activityEvent.session_id) {
        throw new Error('session_id required for session_all recipient type');
      }
      // Get students
      const { data: sessionStudents } = await supabase
        .from('sessions_students')
        .select('student_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStudents) {
        recipients.push(...sessionStudents.map((ss: any) => ({ student_id: ss.student_id })));
      }
      
      // Get staff
      const { data: sessionStaff } = await supabase
        .from('sessions_staff')
        .select('staff_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStaff) {
        recipients.push(...sessionStaff.map((ss: any) => ({ staff_id: ss.staff_id })));
      }
      break;
    }

    case 'single': {
      // Single recipient - handled by caller
      break;
    }

    default:
      throw new Error(`Unknown recipient type: ${recipientType}`);
  }

  return recipients;
}

// Helper function to resolve message recipients (contacts) based on recipient type
export async function resolveMessageRecipients(
  supabase: any,
  recipientType: string,
  activityEvent: any
): Promise<string[]> {
  const contactIds: string[] = [];

  switch (recipientType) {
    case 'class_students': {
      if (!activityEvent.class_id) {
        throw new Error('class_id required for class_students recipient type');
      }
      const { data: enrollments } = await supabase
        .from('classes_students')
        .select('student_id')
        .eq('class_id', activityEvent.class_id)
        .is('unenrolled_at', null);
      
      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map((e: any) => e.student_id);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id')
          .in('student_id', studentIds)
          .eq('contact_type', 'STUDENT')
          .eq('is_opted_out', false);
        
        if (contacts) {
          contactIds.push(...contacts.map((c: any) => c.id));
        }
      }
      break;
    }

    case 'class_students_and_parents': {
      if (!activityEvent.class_id) {
        throw new Error('class_id required for class_students_and_parents recipient type');
      }
      const { data: enrollments } = await supabase
        .from('classes_students')
        .select('student_id')
        .eq('class_id', activityEvent.class_id)
        .is('unenrolled_at', null);
      
      if (enrollments && enrollments.length > 0) {
        const studentIds = enrollments.map((e: any) => e.student_id);
        
        // Get student contacts
        const { data: studentContacts } = await supabase
          .from('contacts')
          .select('id')
          .in('student_id', studentIds)
          .eq('contact_type', 'STUDENT')
          .eq('is_opted_out', false);
        
        if (studentContacts) {
          contactIds.push(...studentContacts.map((c: any) => c.id));
        }
        
        // Get parent contacts via parents_students
        const { data: parentLinks } = await supabase
          .from('parents_students')
          .select('parent_id')
          .in('student_id', studentIds);
        
        if (parentLinks && parentLinks.length > 0) {
          const parentIds = parentLinks.map((pl: any) => pl.parent_id);
          const { data: parentContacts } = await supabase
            .from('contacts')
            .select('id')
            .in('parent_id', parentIds)
            .eq('contact_type', 'PARENT')
            .eq('is_opted_out', false);
          
          if (parentContacts) {
            contactIds.push(...parentContacts.map((c: any) => c.id));
          }
        }
      }
      break;
    }

    case 'session_students': {
      if (!activityEvent.session_id) {
        throw new Error('session_id required for session_students recipient type');
      }
      const { data: sessionStudents } = await supabase
        .from('sessions_students')
        .select('student_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStudents && sessionStudents.length > 0) {
        const studentIds = sessionStudents.map((ss: any) => ss.student_id);
        const { data: contacts } = await supabase
          .from('contacts')
          .select('id')
          .in('student_id', studentIds)
          .eq('contact_type', 'STUDENT')
          .eq('is_opted_out', false);
        
        if (contacts) {
          contactIds.push(...contacts.map((c: any) => c.id));
        }
      }
      break;
    }

    case 'session_students_and_parents': {
      if (!activityEvent.session_id) {
        throw new Error('session_id required for session_students_and_parents recipient type');
      }
      const { data: sessionStudents } = await supabase
        .from('sessions_students')
        .select('student_id')
        .eq('session_id', activityEvent.session_id);
      
      if (sessionStudents && sessionStudents.length > 0) {
        const studentIds = sessionStudents.map((ss: any) => ss.student_id);
        
        // Get student contacts
        const { data: studentContacts } = await supabase
          .from('contacts')
          .select('id')
          .in('student_id', studentIds)
          .eq('contact_type', 'STUDENT')
          .eq('is_opted_out', false);
        
        if (studentContacts) {
          contactIds.push(...studentContacts.map((c: any) => c.id));
        }
        
        // Get parent contacts via parents_students
        const { data: parentLinks } = await supabase
          .from('parents_students')
          .select('parent_id')
          .in('student_id', studentIds);
        
        if (parentLinks && parentLinks.length > 0) {
          const parentIds = parentLinks.map((pl: any) => pl.parent_id);
          const { data: parentContacts } = await supabase
            .from('contacts')
            .select('id')
            .in('parent_id', parentIds)
            .eq('contact_type', 'PARENT')
            .eq('is_opted_out', false);
          
          if (parentContacts) {
            contactIds.push(...parentContacts.map((c: any) => c.id));
          }
        }
      }
      break;
    }

    case 'single': {
      // Single recipient - handled by caller
      break;
    }

    default:
      throw new Error(`Unknown recipient type: ${recipientType}`);
  }

  // Deduplicate contact IDs
  return [...new Set(contactIds)];
}
