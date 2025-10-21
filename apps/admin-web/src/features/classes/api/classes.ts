import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/**
 * Classes API client for working with class data
 */
export const classesApi = {
  /**
   * Get all classes
   */
  getAllClasses: async (): Promise<Tables<'classes'>[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('classes')
      .select('id, subject_id, day_of_week, start_time, end_time, status, room');
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
  
  /**
   * Get all classes with their associated subject, students, and staff in optimized single queries
   * This solves the N+1 query problem for the classes table
   */
  getAllClassesWithDetails: async (): Promise<{ 
    classes: Tables<'classes'>[]; 
    classSubjects: Record<string, Tables<'subjects'>>;
    classStudents: Record<string, Tables<'students'>[]>; 
    classStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = getSupabaseClient();
    type ClassRowWithSubject = Tables<'classes'> & { subject_details?: Tables<'subjects'> };
    type EnrollmentRow = { class_id: string; student: Tables<'students'> | null };
    type AssignmentRow = { class_id: string; staff: Tables<'staff'> | null };
    
    try {
      // Get all classes with their subjects
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id, subject_id, day_of_week, start_time, end_time, status, room,
          subject_details:subjects(*)
        `);
      
      if (classesError) throw classesError;
      
      // Get all class enrollments with student data
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          student:students(*)
        `)
        .eq('status', 'ACTIVE');
      
      if (enrollmentsError) throw enrollmentsError;
      
      // Get all class assignments with staff data
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('classes_staff')
        .select(`
          class_id,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .eq('status', 'ACTIVE');
      
      if (assignmentsError) throw assignmentsError;
      
      // Transform and organize the data
      const classes: Tables<'classes'>[] = [];
      const classSubjects: Record<string, Tables<'subjects'>> = {};
      const classStudents: Record<string, Tables<'students'>[]> = {};
      const classStaff: Record<string, Tables<'staff'>[]> = {};
      
      // Process classes
      (classesData as ClassRowWithSubject[] | null)?.forEach((row) => {
        const cls = row as Tables<'classes'>;
        classes.push(cls);
        
        // Add subject if available
        if (row.subject_details) {
          classSubjects[cls.id] = row.subject_details as Tables<'subjects'>;
        }
        
        // Initialize arrays
        classStudents[cls.id] = [];
        classStaff[cls.id] = [];
      });
      
      // Process enrollments
      (enrollmentsData as EnrollmentRow[] | null)?.forEach((row) => {
        if (row.student && row.class_id) {
          if (!classStudents[row.class_id]) {
            classStudents[row.class_id] = [];
          }
          classStudents[row.class_id].push(row.student);
        }
      });
      
      // Process assignments
      (assignmentsData as AssignmentRow[] | null)?.forEach((row) => {
        if (row.staff && row.class_id) {
          if (!classStaff[row.class_id]) {
            classStaff[row.class_id] = [];
          }
          classStaff[row.class_id].push(row.staff);
        }
      });
      
      return {
        classes,
        classSubjects,
        classStudents,
        classStaff
      };
      
    } catch (error) {
      console.error('Error getting classes with details:', error);
      throw error;
    }
  },

  /**
   * Get classes with details for a specific staff member (via classes_staff)
   */
  getClassesForStaffWithDetails: async (staffId: string): Promise<{ 
    classes: Tables<'classes'>[]; 
    classSubjects: Record<string, Tables<'subjects'>>;
    classStudents: Record<string, Tables<'students'>[]>; 
    classStaff: Record<string, Tables<'staff'>[]>;
  }> => {
    const supabase = getSupabaseClient();
    type ClassRowWithSubject = Tables<'classes'> & { subject_details?: Tables<'subjects'> };
    type EnrollmentRow = { class_id: string; student: Tables<'students'> | null };
    type AssignmentRow = { class_id: string; staff: Tables<'staff'> | null };
    
    try {
      // Get class ids for the staff member
      const { data: assignmentData, error: assignmentError } = await supabase
        .from('classes_staff')
        .select('class_id')
        .eq('staff_id', staffId)
        .eq('status', 'ACTIVE');
      if (assignmentError) throw assignmentError;
      const assignmentRows: Array<{ class_id: string }> = (assignmentData ?? []) as Array<{ class_id: string }>;
      const classIds = assignmentRows.map((r) => r.class_id);
      if (!classIds.length) {
        return { classes: [], classSubjects: {}, classStudents: {}, classStaff: {} };
      }

      // Fetch only those classes with subject
      const { data: classesData, error: classesError } = await supabase
        .from('classes')
        .select(`
          id, subject_id, day_of_week, start_time, end_time, status, room,
          subject_details:subjects(*)
        `)
        .in('id', classIds);
      if (classesError) throw classesError;

      // Enrollments for those classes
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          student:students(*)
        `)
        .in('class_id', classIds)
        .eq('status', 'ACTIVE');
      if (enrollmentsError) throw enrollmentsError;

      // Staff for those classes
      const { data: assignmentsData, error: assignmentsError } = await supabase
        .from('classes_staff')
        .select(`
          class_id,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .in('class_id', classIds)
        .eq('status', 'ACTIVE');
      if (assignmentsError) throw assignmentsError;

      // Transform
      const classes: Tables<'classes'>[] = [];
      const classSubjects: Record<string, Tables<'subjects'>> = {};
      const classStudents: Record<string, Tables<'students'>[]> = {};
      const classStaff: Record<string, Tables<'staff'>[]> = {};

      (classesData as ClassRowWithSubject[] | null)?.forEach((row) => {
        const cls = row as Tables<'classes'>;
        classes.push(cls);
        if (row.subject_details) {
          classSubjects[cls.id] = row.subject_details as Tables<'subjects'>;
        }
        classStudents[cls.id] = [];
        classStaff[cls.id] = [];
      });

      (enrollmentsData as EnrollmentRow[] | null)?.forEach((row) => {
        if (row.student && row.class_id) {
          if (!classStudents[row.class_id]) classStudents[row.class_id] = [];
          classStudents[row.class_id].push(row.student);
        }
      });

      (assignmentsData as AssignmentRow[] | null)?.forEach((row) => {
        if (row.staff && row.class_id) {
          if (!classStaff[row.class_id]) classStaff[row.class_id] = [];
          classStaff[row.class_id].push(row.staff);
        }
      });

      return { classes, classSubjects, classStudents, classStaff };
    } catch (error) {
      console.error('Error getting classes for staff with details:', error);
      throw error;
    }
  },

  /**
   * Lightweight aggregates for dashboard
   */
  getAggregates: async (): Promise<{
    totalClasses: number;
    totalClassEnrollments: number;
  }> => {
    const supabase = getSupabaseClient();

    const [
      { count: classesCount, error: classesErr },
      { count: enrollmentsCount, error: enrollErr },
    ] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase
        .from('classes_students')
        .select('class_id', { count: 'exact', head: true })
        .eq('status', 'ACTIVE'),
    ]);

    if (classesErr) throw classesErr;
    if (enrollErr) throw enrollErr;

    return {
      totalClasses: classesCount ?? 0,
      totalClassEnrollments: enrollmentsCount ?? 0,
    };
  },
  
  /**
   * Get a single class with its details
   */
  getClassWithDetails: async (classId: string): Promise<{
    class: Tables<'classes'> | null;
    subject: Tables<'subjects'> | null;
    students: Tables<'students'>[];
    staff: Tables<'staff'>[];
  }> => {
    const supabase = getSupabaseClient();
    
    try {
      // Get class with subject
      const { data: classData, error: classError } = await supabase
        .from('classes')
        .select(`
          *,
          subject_details:subjects(*)
        `)
        .eq('id', classId)
        .single();
      
      if (classError) {
        if (classError.code === 'PGRST116') {
          return { class: null, subject: null, students: [], staff: [] };
        }
        throw classError;
      }
      
      // Get students for this class
      const { data: studentsData, error: studentsError } = await supabase
        .from('classes_students')
        .select(`
          student:students(*)
        `)
        .eq('class_id', classId)
        .eq('status', 'ACTIVE');
      
      if (studentsError) throw studentsError;
      
      // Get staff for this class
      const { data: staffData, error: staffError } = await supabase
        .from('classes_staff')
        .select(`
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .eq('class_id', classId)
        .eq('status', 'ACTIVE');
      
      if (staffError) throw staffError;
      
      // Transform the data
      const cls = classData as Tables<'classes'>;
      const subject = (classData as { subject_details?: Tables<'subjects'> } | null)?.subject_details ?? null;
      const students = ((studentsData as Array<{ student: Tables<'students'> | null }> | null) ?? [])
        .map((row) => row.student)
        .filter(Boolean) as Tables<'students'>[];
      const staffRows: Array<{ staff: Tables<'staff'> | null }> = staffData ? ((staffData as unknown) as Array<{ staff: Tables<'staff'> | null }>) : [];
      const staff = staffRows
        .map((row) => row.staff)
        .filter(Boolean) as Tables<'staff'>[];
      
      return { class: cls, subject, students, staff };
      
    } catch (error) {
      console.error('Error getting class with details:', error);
      throw error;
    }
  },
  
  /**
   * Get a class by ID
   */
  getClass: async (id: string): Promise<Tables<'classes'> | null> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('classes').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'classes'> | null;
  },
  
  /**
   * Create a new class
   */
  createClass: async (data: TablesInsert<'classes'>): Promise<Tables<'classes'>> => {
    const payload: TablesInsert<'classes'> = data;
    const supabase = getSupabaseClient();
    const { data: created, error } = await supabase.from('classes').insert(payload).select().single();
    if (error) throw error;
    return created as Tables<'classes'>;
  },
  
  /**
   * Update a class
   */
  updateClass: async (id: string, data: TablesUpdate<'classes'>): Promise<Tables<'classes'>> => {
    const supabase = getSupabaseClient();
    const { data: updated, error } = await supabase.from('classes').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated as Tables<'classes'>;
  },
  
  /**
   * Delete a class
   */
  deleteClass: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },
  
  /**
   * Get all students enrolled in a class
   */
  getClassStudents: async (classId: string): Promise<Tables<'students'>[]> => {
    try {
      // Get ACTIVE class enrollments for this class at the DB layer
      const { data: enrollments, error } = await getSupabaseClient()
        .from('classes_students')
        .select('student:students(*), class_id')
        .eq('class_id', classId)
        .eq('status', 'ACTIVE');
      if (error) throw error;
      
      if (!((enrollments as Array<{ student: Tables<'students'> | null }> | null) ?? []).length) {
        return [];
      }
      
      // Map enrolled rows to student objects
      return ((enrollments as Array<{ student: Tables<'students'> | null }>) || [])
        .map((enrollment) => enrollment.student)
        .filter(Boolean) as Tables<'students'>[];
    } catch (error) {
      console.error('Error getting class students:', error);
      throw error;
    }
  },
  
  /**
   * Get all staff assigned to a class
   */
  getClassStaff: async (classId: string): Promise<Tables<'staff'>[]> => {
    try {
      // Get all class assignments for this class
      const { data: assignments, error } = await getSupabaseClient().from('classes_staff').select('staff:staff(*), class_id, status').eq('class_id', classId).eq('status', 'ACTIVE');
      if (error) throw error;
      
      // Filter for active assignments
      if (!(assignments ?? []).length) {
        return [];
      }
      const assignmentRows: Array<{ staff: Tables<'staff'> | null }> = assignments ? ((assignments as unknown) as Array<{ staff: Tables<'staff'> | null }>) : [];
      return assignmentRows
        .map((row) => row.staff)
        .filter(Boolean) as Tables<'staff'>[];
    } catch (error) {
      console.error('Error getting class staff:', error);
      throw error;
    }
  },
  
  /**
   * Enroll a student in a class
   */
  enrollStudent: async (classId: string, studentId: string): Promise<Tables<'classes_students'>> => {
    try {
      const supabase = getSupabaseClient();
      const { data: existing, error: existingError } = await supabase
        .from('classes_students')
        .select('id')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .eq('status', 'ACTIVE')
        .limit(1);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return (existing![0] as Tables<'classes_students'>);

      const payload: TablesInsert<'classes_students'> = {
        id: crypto.randomUUID(),
        class_id: classId,
        student_id: studentId,
        start_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
      };
      const { data, error } = await supabase
        .from('classes_students')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Tables<'classes_students'>;
    } catch (error) {
      console.error('Error enrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Remove a student from a class
   */
  unenrollStudent: async (classId: string, studentId: string): Promise<void> => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('classes_students')
        .update({ status: 'INACTIVE', end_date: new Date().toISOString().split('T')[0] })
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .eq('status', 'ACTIVE');
      if (error) throw error;
    } catch (error) {
      console.error('Error unenrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Assign a staff member to a class
   */
  assignStaff: async (classId: string, staffId: string): Promise<Tables<'classes_staff'>> => {
    try {
      const supabase = getSupabaseClient();
      const { data: existing, error: existingError } = await supabase
        .from('classes_staff')
        .select('id')
        .eq('class_id', classId)
        .eq('staff_id', staffId)
        .eq('status', 'ACTIVE')
        .limit(1);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return (existing![0] as Tables<'classes_staff'>);

      const payload: TablesInsert<'classes_staff'> = {
        id: crypto.randomUUID(),
        class_id: classId,
        staff_id: staffId,
        start_date: new Date().toISOString().split('T')[0],
        status: 'ACTIVE',
      };
      const { data, error } = await supabase
        .from('classes_staff')
        .insert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as Tables<'classes_staff'>;
    } catch (error) {
      console.error('Error assigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Remove a staff member from a class
   */
  unassignStaff: async (classId: string, staffId: string): Promise<void> => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('classes_staff')
        .update({ status: 'INACTIVE', end_date: new Date().toISOString().split('T')[0] })
        .eq('class_id', classId)
        .eq('staff_id', staffId)
        .eq('status', 'ACTIVE');
      if (error) throw error;
    } catch (error) {
      console.error('Error unassigning staff:', error);
      throw error;
    }
  },
  
  /**
   * Get classes by day of week
   */
  getClassesByDay: async (dayOfWeek: number): Promise<Tables<'classes'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('classes')
      .select('*')
      .eq('day_of_week', dayOfWeek);
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
  
  /**
   * Get classes by status
   */
  getClassesByStatus: async (status: string): Promise<Tables<'classes'>[]> => {
    const { data, error } = await getSupabaseClient()
      .from('classes')
      .select('*')
      .eq('status', status);
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
}; 