import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { Tables, Database } from '@altitutor/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatClassShortName, formatClassName } from '@/shared/utils';
import { dateStringToUtcStart, dateStringToUtcEnd } from '@/shared/utils/datetime';

/**
 * Search active students by name and classes
 * Returns students with phone and email fields
 */
type ClassEnrollmentRow = {
  student_id: string;
  class: {
    day_of_week: number;
    start_time: string;
    end_time: string;
    subject_details: Pick<Tables<'subjects'>, 'curriculum' | 'year_level' | 'discipline' | 'name' | 'short_name'> | null;
  } | null;
};

type StudentSearchRow = Pick<Tables<'students'>, 'id' | 'first_name' | 'last_name' | 'school'>;

export async function searchStudents(searchQuery: string, limit: number = 50): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient();
  const trimmed = searchQuery.trim();
  
  if (trimmed.length === 0) {
    return [];
  }
  
  const searchLower = trimmed.toLowerCase();
  
  // First, get student IDs that match class names (short or full)
  let studentIdsFromClasses: string[] = [];
  
  // Search in classes: join classes_students -> classes -> subjects
  const { data: classEnrollmentsData, error: classSearchError } = await supabase
    .from('classes_students')
    .select(`
      student_id,
      class:classes(
        day_of_week,
        start_time,
        end_time,
        subject_details:subjects(
          curriculum,
          year_level,
          discipline,
          name,
          short_name
        )
      )
    `)
    .is('unenrolled_at', null);
  
  if (!classSearchError && classEnrollmentsData) {
    const matchingStudentIds = new Set<string>();
    const typedEnrollments = classEnrollmentsData as ClassEnrollmentRow[];
    
    typedEnrollments.forEach((enrollment) => {
      const cls = enrollment.class;
      const subject = cls?.subject_details;
      
      if (cls && subject) {
        // Use utility functions to format class names consistently with UI
        // Cast cls to Tables<'classes'> for the utility functions
        const classForFormatting = cls as unknown as Tables<'classes'>;
        // Cast subject to Tables<'subjects'> for the utility functions
        const subjectForFormatting = subject as unknown as Tables<'subjects'>;
        const shortName = formatClassShortName(classForFormatting, subjectForFormatting).toLowerCase();
        const fullName = formatClassName(classForFormatting, subjectForFormatting).toLowerCase();
        
        // Check if search term matches short name or full name
        if (shortName.includes(searchLower) || fullName.includes(searchLower)) {
          matchingStudentIds.add(enrollment.student_id);
        }
      }
    });
    
    studentIdsFromClasses = Array.from(matchingStudentIds);
  }
  
  // Search in student names (concatenated) and school
  const { data: nameSearchData, error: nameSearchError } = await supabase
    .from('students')
    .select('id, first_name, last_name, school')
    .eq('status', 'ACTIVE')
    .or(`first_name.ilike.%${trimmed}%,last_name.ilike.%${trimmed}%,school.ilike.%${trimmed}%`);
  
  if (nameSearchError) throw nameSearchError;
  
  // Filter for concatenated name matches and school matches
  const typedNameSearchData = (nameSearchData || []) as StudentSearchRow[];
  const studentIdsFromNames = typedNameSearchData
    .filter((s) => {
      const fullName = `${s.first_name || ''} ${s.last_name || ''}`.trim().toLowerCase();
      const schoolMatch = (s.school || '').toLowerCase().includes(searchLower);
      return fullName.includes(searchLower) || 
             (s.first_name || '').toLowerCase().includes(searchLower) ||
             (s.last_name || '').toLowerCase().includes(searchLower) ||
             schoolMatch;
    })
    .map((s) => s.id);
  
  // Combine student IDs from both searches
  const allMatchingStudentIds = Array.from(new Set([...studentIdsFromNames, ...studentIdsFromClasses]));
  
  if (allMatchingStudentIds.length === 0) {
    return [];
  }
  
  // Fetch full student records with phone and email
  const { data: students, error } = await supabase
    .from('students')
    .select('*')
    .in('id', allMatchingStudentIds)
    .eq('status', 'ACTIVE')
    .order('last_name', { ascending: true })
    .order('first_name', { ascending: true })
    .limit(limit);
  
  if (error) throw error;
  
  return (students || []) as Tables<'students'>[];
}

type StudentSubjectRow = {
  student: Tables<'students'>;
};

/**
 * Get students by subject ID (active only, with phone and email)
 */
export async function getStudentsBySubject(subjectId: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('students_subjects')
    .select('student:students(*)')
    .eq('subject_id', subjectId);
  
  if (error) throw error;
  
  // Filter to active students only and ensure phone/email are included
  const typedData = (data || []) as StudentSubjectRow[];
  return typedData
    .map((item) => item.student)
    .filter((student): student is Tables<'students'> => student !== null && student.status === 'ACTIVE');
}

type ClassStudentRow = {
  student: Tables<'students'>;
};

/**
 * Get students by class ID (active only, with phone and email)
 */
export async function getStudentsByClass(classId: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('classes_students')
    .select('student:students(*)')
    .eq('class_id', classId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
  
  if (error) throw error;
  
  // Filter to active students only
  const typedData = (data || []) as ClassStudentRow[];
  return typedData
    .map((item) => item.student)
    .filter((student): student is Tables<'students'> => student !== null && student.status === 'ACTIVE');
}

/**
 * Get students by year level (active only, with phone and email)
 */
export async function getStudentsByYearLevel(yearLevel: number): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('year_level', yearLevel)
    .eq('status', 'ACTIVE');
  
  if (error) throw error;
  
  return (data || []) as Tables<'students'>[];
}

type SessionStudentRow = {
  student: Tables<'students'>;
};

/**
 * Get students by session date (active only, with phone and email)
 */
export async function getStudentsBySessionDate(date: string): Promise<Tables<'students'>[]> {
  const supabase = getSupabaseClient();
  
  // Query sessions on this date (interpret date as local timezone and convert to UTC)
  const startIso = dateStringToUtcStart(date);
  const endIso = dateStringToUtcEnd(date);
  
  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id')
    .gte('start_at', startIso)
    .lte('start_at', endIso);
  
  if (sessionsError) throw sessionsError;
  
  if (!sessions || sessions.length === 0) {
    return [];
  }
  
  const sessionIds = sessions.map(s => s.id);
  
  // Get all students in these sessions
  const { data: sessionStudents, error: ssError } = await supabase
    .from('sessions_students')
    .select('student:students(*)')
    .in('session_id', sessionIds)
    .eq('planned_absence', false);
  
  if (ssError) throw ssError;
  
  // Filter to active students only
  const typedSessionStudents = (sessionStudents || []) as SessionStudentRow[];
  return typedSessionStudents
    .map((item) => item.student)
    .filter((student): student is Tables<'students'> => student !== null && student.status === 'ACTIVE');
}

type ClassWithSubjectRow = {
  class: Tables<'classes'> & {
    subject: Tables<'subjects'> | null;
  } | null;
};

/**
 * Get student's enrolled classes with subject details
 */
export async function getStudentClasses(studentId: string): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
}>> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('classes_students')
    .select(`
      class:classes(
        *,
        subject:subjects(*)
      )
    `)
    .eq('student_id', studentId)
    .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
  
  if (error) throw error;
  
  const typedData = (data || []) as ClassWithSubjectRow[];
  return typedData
    .filter((item): item is { class: NonNullable<ClassWithSubjectRow['class']> } => item.class !== null)
    .map((item) => ({
      class: item.class,
      subject: item.class.subject || null,
    }));
}

/**
 * Get student's enrolled classes with their first session start dates
 * Returns classes with the date of the first session where the student is enrolled and not marked as absent
 */
export async function getStudentClassesWithStartDates(studentId: string): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
  startDate: Date | null;
}>> {
  const supabase = getSupabaseClient();
  
  // First get all enrolled classes
  const classes = await getStudentClasses(studentId);
  
  if (classes.length === 0) {
    return [];
  }
  
  const classIds = classes.map(c => c.class.id);
  
  // Get the first non-absent session for each class (only future sessions)
  const now = new Date().toISOString();
  
  // Query sessions_students and join sessions, then filter and sort in memory
  // Note: We can't order by nested relation fields in Supabase, so we fetch all and sort client-side
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions_students')
    .select(`
      session:sessions!inner(
        id,
        class_id,
        start_at
      )
    `)
    .eq('student_id', studentId)
    .eq('planned_absence', false)
    .in('session.class_id', classIds)
    .gte('session.start_at', now);
  
  if (sessionsError) {
    console.error('Error fetching sessions for classes:', sessionsError);
    // Return classes without start dates if we can't fetch sessions
    return classes.map(c => ({ ...c, startDate: null }));
  }
  
  // Sort sessions by start_at ascending (client-side since we can't order by nested relation)
  type SessionWithClassRow = { session?: { class_id?: string | null; start_at?: string | null } };
  const sortedSessions = (sessionsData || []).sort((a, b) => {
    const dateA = a.session?.start_at ? new Date(a.session.start_at).getTime() : 0;
    const dateB = b.session?.start_at ? new Date(b.session.start_at).getTime() : 0;
    return dateA - dateB;
  });
  
  // Build a map of class_id -> first session start_at
  const classStartDateMap = new Map<string, Date>();
  const processedClasses = new Set<string>();
  
  sortedSessions.forEach((item) => {
    const session = item.session;
    if (session?.class_id && session?.start_at && !processedClasses.has(session.class_id)) {
      classStartDateMap.set(session.class_id, new Date(session.start_at));
      processedClasses.add(session.class_id);
    }
  });
  
  // Map classes with their start dates
  return classes.map(c => ({
    class: c.class,
    subject: c.subject,
    startDate: classStartDateMap.get(c.class.id) || null,
  }));
}

type EnrollmentWithClassRow = {
  student_id: string;
  unenrolled_at: string | null;
  class: (Tables<'classes'> & {
    subject_details: Tables<'subjects'> | null;
  }) | null;
};

/**
 * Get classes for multiple students (for table display)
 * Returns a map of student ID to array of classes with subject details
 */
export async function getStudentsClasses(studentIds: string[]): Promise<Record<string, Array<{
  id: string;
  day_of_week: number;
  start_time: string;
  level: string | null;
  subject?: Tables<'subjects'> | null;
}>>> {
  if (studentIds.length === 0) return {};
  
  const supabase = getSupabaseClient();
  
  // Get all student-class enrollments with class details AND subject information
  const { data: enrollmentsData, error: enrollmentsError } = await supabase
    .from('classes_students')
    .select(`
      student_id,
      unenrolled_at,
      class:classes(*, subject_details:subjects(*))
    `)
    .in('student_id', studentIds);
  
  if (enrollmentsError) throw enrollmentsError;
  
  // Filter to current/future enrollments only
  const typedEnrollments = (enrollmentsData ?? []) as EnrollmentWithClassRow[];
  const activeEnrollments = typedEnrollments.filter((e) => 
    !e.unenrolled_at || new Date(e.unenrolled_at) > new Date()
  );
  
  // Build student -> classes map with subject data
  const studentClassesMap: Record<string, Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }>> = {};
  studentIds.forEach(id => {
    studentClassesMap[id] = [];
  });
  
  activeEnrollments.forEach((enrollment) => {
    const classWithSubject = enrollment.class;
    if (classWithSubject && enrollment.student_id) {
      studentClassesMap[enrollment.student_id].push({
        id: classWithSubject.id,
        day_of_week: classWithSubject.day_of_week,
        start_time: classWithSubject.start_time,
        level: classWithSubject.level,
        subject: classWithSubject.subject_details || null,
      });
    }
  });
  
  return studentClassesMap;
}

/**
 * Get all subjects (for filter dropdown)
 */
export async function getAllSubjects(): Promise<Tables<'subjects'>[]> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('subjects')
    .select('*')
    .order('curriculum', { ascending: true })
    .order('year_level', { ascending: true })
    .order('name', { ascending: true });
  
  if (error) throw error;
  
  return (data || []) as Tables<'subjects'>[];
}

type ClassWithSubject = Tables<'classes'> & {
  subject: Tables<'subjects'> | null;
};

/**
 * Get all classes (for filter dropdown)
 */
export async function getAllClasses(): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
}>> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('classes')
    .select(`
      *,
      subject:subjects(*)
    `)
    .eq('status', 'ACTIVE')
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });
  
  if (error) throw error;
  
  const typedData = (data || []) as ClassWithSubject[];
  return typedData.map((cls) => ({
    class: cls,
    subject: cls.subject || null,
  }));
}

type StaffClassWithSubjectRow = {
  class: Tables<'classes'> & {
    subject: Tables<'subjects'> | null;
  } | null;
};

/**
 * Get staff member's assigned classes with subject details
 */
export async function getStaffClasses(staffId: string): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
}>> {
  const supabase = getSupabaseClient();
  
  const { data, error } = await supabase
    .from('classes_staff')
    .select(`
      class:classes(
        *,
        subject:subjects(*)
      )
    `)
    .eq('staff_id', staffId)
    .is('unassigned_at', null);
  
  if (error) throw error;
  
  const typedData = (data || []) as StaffClassWithSubjectRow[];
  return typedData
    .filter((item): item is { class: NonNullable<StaffClassWithSubjectRow['class']> } => item.class !== null)
    .map((item) => ({
      class: item.class,
      subject: item.class.subject || null,
    }));
}

/**
 * Get staff member's assigned classes with their first session start dates
 * Returns classes with the date of the first session where the staff is assigned
 */
export async function getStaffClassesWithStartDates(staffId: string): Promise<Array<{
  class: Tables<'classes'>;
  subject: Tables<'subjects'> | null;
  startDate: Date | null;
}>> {
  const supabase = getSupabaseClient();
  
  // First get all assigned classes
  const classes = await getStaffClasses(staffId);
  
  if (classes.length === 0) {
    return [];
  }
  
  const classIds = classes.map(c => c.class.id);
  
  // Get the first session for each class (only future sessions)
  const now = new Date().toISOString();
  
  // Query sessions_staff and join sessions, then filter and sort in memory
  const { data: sessionsData, error: sessionsError } = await supabase
    .from('sessions_staff')
    .select(`
      session:sessions!inner(
        id,
        class_id,
        start_at
      )
    `)
    .eq('staff_id', staffId)
    .in('session.class_id', classIds)
    .gte('session.start_at', now);
  
  if (sessionsError) {
    console.error('Error fetching sessions for staff classes:', sessionsError);
    // Return classes without start dates if we can't fetch sessions
    return classes.map(c => ({ ...c, startDate: null }));
  }
  
  // Sort sessions by start_at ascending (client-side)
  type SessionWithClassRow = { session?: { class_id?: string | null; start_at?: string | null } };
  const sortedSessions = (sessionsData || []).sort((a, b) => {
    const dateA = a.session?.start_at ? new Date(a.session.start_at).getTime() : 0;
    const dateB = b.session?.start_at ? new Date(b.session.start_at).getTime() : 0;
    return dateA - dateB;
  });
  
  // Build a map of class_id -> first session start_at
  const classStartDateMap = new Map<string, Date>();
  const processedClasses = new Set<string>();
  
  sortedSessions.forEach((item) => {
    const session = item.session;
    if (session?.class_id && session?.start_at && !processedClasses.has(session.class_id)) {
      classStartDateMap.set(session.class_id, new Date(session.start_at));
      processedClasses.add(session.class_id);
    }
  });
  
  // Map classes with their start dates
  return classes.map(c => ({
    class: c.class,
    subject: c.subject,
    startDate: classStartDateMap.get(c.class.id) || null,
  }));
}

export interface MessagePreviewRecipient {
  id: string;
  type: 'student' | 'parent';
  name: string;
  phone: string | null;
  studentId?: string;
}

export interface MessagePreviewData {
  recipients: MessagePreviewRecipient[];
  studentClasses: Record<
    string,
    Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>
  >;
}

type ParentStudentRow = {
  parent_id: string;
  student_id: string;
  parents: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    phone: string | null;
  } | null;
};

/**
 * Fetch recipients and student classes for bulk message preview.
 * Replaces useEffect-based loading in MessagePreview component.
 */
export async function fetchMessagePreviewData(
  students: Tables<'students'>[],
  sendToParents: boolean
): Promise<MessagePreviewData> {
  const allRecipients: MessagePreviewRecipient[] = [];
  const classesMap: Record<
    string,
    Array<{ class: Tables<'classes'>; subject: Tables<'subjects'> | null }>
  > = {};

  // Load student classes in parallel
  const classResults = await Promise.all(
    students.map((s) => getStudentClasses(s.id))
  );
  students.forEach((student, i) => {
    allRecipients.push({
      id: student.id,
      type: 'student',
      name: `${student.first_name || ''} ${student.last_name || ''}`.trim(),
      phone: student.phone,
    });
    classesMap[student.id] = classResults[i];
  });

  if (sendToParents && students.length > 0) {
    const supabase = getSupabaseClient() as SupabaseClient<Database>;
    const studentIds = students.map((s) => s.id);
    const { data: parentStudents, error } = await supabase
      .from('parents_students')
      .select(
        `
        parent_id,
        student_id,
        parents (
          id,
          first_name,
          last_name,
          phone
        )
      `
      )
      .in('student_id', studentIds);

    if (!error && parentStudents) {
      const typed = parentStudents as ParentStudentRow[];
      typed.forEach((ps) => {
        if (ps.parents) {
          allRecipients.push({
            id: `parent-${ps.parent_id}`,
            type: 'parent',
            name: `${ps.parents.first_name || ''} ${ps.parents.last_name || ''}`.trim(),
            phone: ps.parents.phone,
            studentId: ps.student_id,
          });
        }
      });
    }
  }

  return { recipients: allRecipients, studentClasses: classesMap };
}






