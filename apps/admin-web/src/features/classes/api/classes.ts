import type { Tables, TablesInsert, TablesUpdate, Database } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

type MinimalClass = Pick<
  Tables<'classes'>,
  'id' | 'day_of_week' | 'start_time' | 'end_time' | 'status' | 'room' | 'subject_id' | 'level'
> & {
  subject?: Tables<'subjects'> | null;
  studentCount?: number;
  students?: Tables<'students'>[];
  staff?: Tables<'staff'>[];
};

/**
 * Classes API client for working with class data
 */
export const classesApi = {
  /**
   * Get all classes
   */
  getAllClasses: async (): Promise<Tables<'classes'>[]> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('classes')
      .select('id, subject_id, day_of_week, start_time, end_time, status, room');
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },
  
  /**
   * Minimal fields for table display only
   * Returns: id, name, day_of_week, start_time, end_time, level, room
   * WITH: subject(name, discipline, curriculum)
   * WITH: student count only (not full student records)
   */
  listMinimal: async (params?: {
    search?: string;
    dayOfWeek?: number | number[];
    daysOfWeek?: number[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'classes'>;
    ascending?: boolean;
  }): Promise<{
    classes: MinimalClass[];
    total: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const {
      search = '',
      dayOfWeek,
      daysOfWeek = [],
      limit = 50,
      offset = 0,
      orderBy = 'day_of_week',
      ascending = true,
    } = params || {};

    const trimmed = search.trim();
    const dayFilters = Array.isArray(dayOfWeek)
      ? dayOfWeek
      : daysOfWeek.length > 0
        ? daysOfWeek
        : dayOfWeek !== undefined
          ? [dayOfWeek]
          : [];

    // Use RPC function when search term is provided
    if (trimmed.length > 0) {
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_classes_admin', {
        p_search: trimmed,
        p_statuses: ['ACTIVE'],
        p_include_relationships: true,
        p_limit: limit,
        p_offset: offset,
        p_order_by: orderBy as string,
        p_ascending: ascending,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return { classes: [], total: 0 };

      const rpcData = rpcResult as { classes: any[]; classSubjects: Record<string, any>; classStudents: Record<string, any[]>; classStaff: Record<string, any[]>; total: number };
      let classes = (rpcData.classes || []) as any[];

      // Apply day filter that RPC doesn't support
      if (dayFilters.length > 0) {
        classes = classes.filter((c) => c.day_of_week !== undefined && dayFilters.includes(c.day_of_week));
      }

      // Transform RPC response to match expected format
      const transformedClasses = classes.map((cls: any) => {
        const subject = rpcData.classSubjects?.[cls.id] || null;
        const students = rpcData.classStudents?.[cls.id] || [];
        const staff = rpcData.classStaff?.[cls.id] || [];
        
        return {
          id: cls.id,
          day_of_week: cls.day_of_week,
          start_time: cls.start_time,
          end_time: cls.end_time,
          status: cls.status,
          room: cls.room,
          subject_id: cls.subject_id,
          level: cls.level,
          subject,
          studentCount: students.length,
          students,
          staff,
        };
      }) as MinimalClass[];

      // Recalculate total after filtering (approximate - RPC total may be higher)
      const total = transformedClasses.length < limit ? transformedClasses.length : rpcData.total;

      return {
        classes: transformedClasses,
        total,
      };
    }

    // No search term - use existing query logic
    let query = supabase
      .from('classes')
      .select(
        `
        id,
        day_of_week,
        start_time,
        end_time,
        level,
        room,
        status,
        subject_id,
        subject_details:subjects(*)
        `,
        { count: 'exact' }
      );

    if (dayFilters.length === 1) {
      query = query.eq('day_of_week', dayFilters[0]);
    } else if (dayFilters.length > 1) {
      query = query.in('day_of_week', dayFilters);
    }

    query = query.order(orderBy as string, { ascending });
    if (orderBy !== 'start_time') {
      query = query.order('start_time', { ascending: true });
    }

    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data: classesData, count, error } = await query;
    if (error) throw error;

    const classes = (classesData ?? []) as (Tables<'classes'> & { subject_details?: Tables<'subjects'> })[];
    if (classes.length === 0) {
      return { classes: [], total: count ?? 0 };
    }

    const classIds = classes.map((cls) => cls.id);
    const nowIso = new Date().toISOString();

    const [{ data: enrollmentsData, error: enrollmentsError }, { data: assignmentsData, error: assignmentsError }] = await Promise.all([
      supabase
        .from('classes_students')
        .select(`
          class_id,
          unenrolled_at,
          student:students(*)
        `)
        .in('class_id', classIds)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${nowIso}`),
      supabase
        .from('classes_staff')
        .select(`
          class_id,
          staff:staff!class_assignments_staff_id_fkey(*)
        `)
        .in('class_id', classIds)
        .eq('status', 'ACTIVE'),
    ]);

    if (enrollmentsError) throw enrollmentsError;
    if (assignmentsError) throw assignmentsError;

    const classStudentsMap: Record<string, Tables<'students'>[]> = {};
    const studentCountMap: Record<string, number> = {};
    classIds.forEach((id) => {
      classStudentsMap[id] = [];
      studentCountMap[id] = 0;
    });

    (enrollmentsData ?? []).forEach((enrollment: any) => {
      if (enrollment.class_id && enrollment.student) {
        classStudentsMap[enrollment.class_id].push(enrollment.student as Tables<'students'>);
        studentCountMap[enrollment.class_id] += 1;
      }
    });

    const classStaffMap: Record<string, Tables<'staff'>[]> = {};
    classIds.forEach((id) => {
      classStaffMap[id] = [];
    });

    (assignmentsData ?? []).forEach((assignment: any) => {
      if (assignment.class_id && assignment.staff) {
        classStaffMap[assignment.class_id].push(assignment.staff as Tables<'staff'>);
      }
    });

    const transformedClasses = classes.map((cls) => {
      const subject = cls.subject_details ?? null;
      const { subject_details, ...rest } = cls as typeof cls & { subject_details?: Tables<'subjects'> };
      return {
        ...(rest as Tables<'classes'>),
        subject,
        studentCount: studentCountMap[cls.id] ?? 0,
        students: classStudentsMap[cls.id] || [],
        staff: classStaffMap[cls.id] || [],
      } as MinimalClass;
    }) as MinimalClass[];

    return {
      classes: transformedClasses,
      total: count ?? 0,
    };
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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
      
      // Get all class enrollments with student data (current and future enrollments)
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          student:students(*)
        `)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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

      // Enrollments for those classes (current and future enrollments)
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          class_id,
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          student:students(*)
        `)
        .in('class_id', classIds)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);

    const [
      { count: classesCount, error: classesErr },
      { count: enrollmentsCount, error: enrollErr },
    ] = await Promise.all([
      supabase.from('classes').select('id', { count: 'exact', head: true }),
      supabase
        .from('classes_students')
        .select('class_id', { count: 'exact', head: true })
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`),
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
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
      
      // Get students for this class (current and future enrollments)
      const { data: studentsData, error: studentsError } = await supabase
        .from('classes_students')
        .select(`
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          student:students(*)
        `)
        .eq('class_id', classId)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      
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
   * Get full class details for modal view
   * Returns: class, subject, students (with subjects), staff, upcoming sessions
   */
  getClassDetails: async (classId: string): Promise<{
    class: Tables<'classes'> | null;
    subject: Tables<'subjects'> | null;
    students: (Tables<'students'> & { subjects?: Tables<'subjects'>[] })[];
    staff: Tables<'staff'>[];
    upcomingSessions: Tables<'sessions'>[];
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get base class details
      const baseDetails = await classesApi.getClassWithDetails(classId);
      
      if (!baseDetails.class) {
        return {
          class: null,
          subject: null,
          students: [],
          staff: [],
          upcomingSessions: [],
        };
      }

      // Get student subjects for enrolled students
      const studentIds = baseDetails.students.map(s => s.id);
      const studentSubjectsMap: Record<string, Tables<'subjects'>[]> = {};
      
      if (studentIds.length > 0) {
        const { data: subjectsData, error: subjectsError } = await supabase
          .from('students_subjects')
          .select('student_id, subject_details:subjects(*)')
          .in('student_id', studentIds);
        
        if (subjectsError) throw subjectsError;
        
        studentIds.forEach(id => {
          studentSubjectsMap[id] = [];
        });
        
        (subjectsData ?? []).forEach((row: any) => {
          const sid = row.student_id as string;
          const subj = row.subject_details as Tables<'subjects'> | null;
          if (sid && subj && studentSubjectsMap[sid]) {
            studentSubjectsMap[sid].push(subj);
          }
        });
      }

      // Get upcoming sessions for this class (next 5)
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('sessions')
        .select('*')
        .eq('class_id', classId)
        .gte('start_at', new Date().toISOString())
        .order('start_at', { ascending: true })
        .limit(5);
      
      if (sessionsError) throw sessionsError;

      // Combine students with their subjects
      const studentsWithSubjects = baseDetails.students.map(student => ({
        ...student,
        subjects: studentSubjectsMap[student.id] || [],
      }));

      return {
        class: baseDetails.class,
        subject: baseDetails.subject,
        students: studentsWithSubjects,
        staff: baseDetails.staff,
        upcomingSessions: (sessionsData ?? []) as Tables<'sessions'>[],
      };
    } catch (error) {
      console.error('Error getting class details:', error);
      throw error;
    }
  },
  
  /**
   * Get a class by ID
   */
  getClass: async (id: string): Promise<Tables<'classes'> | null> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase.from('classes').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'classes'> | null;
  },
  
  /**
   * Create a new class
   */
  createClass: async (data: TablesInsert<'classes'>): Promise<Tables<'classes'>> => {
    const payload: TablesInsert<'classes'> = data;
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: created, error } = await supabase.from('classes').insert(payload).select().single();
    if (error) throw error;
    return created as Tables<'classes'>;
  },
  
  /**
   * Update a class
   */
  updateClass: async (id: string, data: TablesUpdate<'classes'>): Promise<Tables<'classes'>> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data: updated, error } = await supabase.from('classes').update(data).eq('id', id).select().single();
    if (error) throw error;
    return updated as Tables<'classes'>;
  },
  
  /**
   * Delete a class
   */
  deleteClass: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { error } = await supabase.from('classes').delete().eq('id', id);
    if (error) throw error;
  },
  
  /**
   * Get all students enrolled in a class (current and future enrollments)
   */
  getClassStudents: async (classId: string): Promise<Tables<'students'>[]> => {
    try {
      // Get current and future class enrollments for this class
      const { data: enrollments, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('classes_students')
        .select('student:students(*), class_id, enrolled_at, enrolled_by, unenrolled_at, unenrolled_by')
        .eq('class_id', classId)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
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
      const { data: assignments, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('classes_staff').select('staff:staff(*), class_id, status').eq('class_id', classId).eq('status', 'ACTIVE');
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
  enrollStudent: async (
    classId: string, 
    studentId: string, 
    enrolledAt: Date, 
    staffId: string
  ): Promise<Tables<'classes_students'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      const payload: TablesInsert<'classes_students'> = {
        id: crypto.randomUUID(),
        class_id: classId,
        student_id: studentId,
        enrolled_at: enrolledAt.toISOString(),
        enrolled_by: staffId,
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
   * Remove a student from a class (immediate or scheduled future unenrollment)
   */
  unenrollStudent: async (
    classId: string, 
    studentId: string, 
    staffId: string, 
    unenrolledAt?: Date
  ): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      const { error } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: (unenrolledAt || new Date()).toISOString(),
          unenrolled_by: staffId 
        })
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null);
      if (error) throw error;
    } catch (error) {
      console.error('Error unenrolling student:', error);
      throw error;
    }
  },
  
  /**
   * Update enrollment date for a future enrollment
   */
  updateEnrollmentDate: async (
    classId: string,
    studentId: string,
    newEnrolledAt: Date,
    staffId: string
  ): Promise<Tables<'classes_students'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // First check if the enrollment is in the future
      const { data: existing, error: fetchError } = await supabase
        .from('classes_students')
        .select('enrolled_at')
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!existing) throw new Error('Enrollment not found');
      
      const enrolledAt = new Date(existing.enrolled_at);
      if (enrolledAt <= new Date()) {
        throw new Error('Cannot update enrollment date for enrollments that have already started');
      }
      
      // Update the enrollment date
      const { data, error } = await supabase
        .from('classes_students')
        .update({ 
          enrolled_at: newEnrolledAt.toISOString(),
          enrolled_by: staffId 
        })
        .eq('class_id', classId)
        .eq('student_id', studentId)
        .is('unenrolled_at', null)
        .select()
        .single();
      
      if (error) throw error;
      return data as Tables<'classes_students'>;
    } catch (error) {
      console.error('Error updating enrollment date:', error);
      throw error;
    }
  },

  /**
   * Change a student from one class to another atomically
   * This unenrolls from the old class and enrolls in the new class in a single operation
   */
  changeClass: async (params: {
    studentId: string;
    oldClassId: string;
    newClassId: string;
    changeoverDate: Date;
    staffId: string;
  }): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get the enrollment record with enrolled_at
      const { data: oldEnrollment, error: fetchError } = await supabase
        .from('classes_students')
        .select('id, enrolled_at')
        .eq('class_id', params.oldClassId)
        .eq('student_id', params.studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!oldEnrollment) throw new Error('Old class enrollment not found');
      
      // Ensure unenrolled_at is strictly after enrolled_at to satisfy constraint
      let unenrolledAt = new Date(params.changeoverDate);
      const enrolledAt = new Date(oldEnrollment.enrolled_at);
      if (unenrolledAt <= enrolledAt) {
        // Add 1 second to ensure it's strictly after
        unenrolledAt = new Date(enrolledAt.getTime() + 1000);
      }
      
      // Unenroll from old class
      const { error: unenrollError } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: unenrolledAt.toISOString(),
          unenrolled_by: params.staffId 
        })
        .eq('id', oldEnrollment.id);
      
      if (unenrollError) throw unenrollError;
      
      // Enroll in new class
      const payload: TablesInsert<'classes_students'> = {
        id: crypto.randomUUID(),
        class_id: params.newClassId,
        student_id: params.studentId,
        enrolled_at: params.changeoverDate.toISOString(),
        enrolled_by: params.staffId,
      };
      
      const { error: enrollError } = await supabase
        .from('classes_students')
        .insert(payload);
      
      if (enrollError) throw enrollError;
    } catch (error) {
      console.error('Error changing class:', error);
      throw error;
    }
  },

  /**
   * Unenroll a student from a class with a reason note
   */
  unenrollStudentWithReason: async (params: {
    classId: string;
    studentId: string;
    unenrolledAt: Date;
    reason: string;
    staffId: string;
  }): Promise<void> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Get the enrollment record with enrolled_at
      const { data: enrollment, error: fetchError } = await supabase
        .from('classes_students')
        .select('id, enrolled_at')
        .eq('class_id', params.classId)
        .eq('student_id', params.studentId)
        .is('unenrolled_at', null)
        .single();
      
      if (fetchError) throw fetchError;
      if (!enrollment) throw new Error('Enrollment not found');
      
      // Ensure unenrolled_at is strictly after enrolled_at to satisfy constraint
      let unenrolledAt = new Date(params.unenrolledAt);
      const enrolledAt = new Date(enrollment.enrolled_at);
      if (unenrolledAt <= enrolledAt) {
        // Add 1 second to ensure it's strictly after
        unenrolledAt = new Date(enrolledAt.getTime() + 1000);
      }
      
      // Unenroll the student
      const { error: unenrollError } = await supabase
        .from('classes_students')
        .update({ 
          unenrolled_at: unenrolledAt.toISOString(),
          unenrolled_by: params.staffId 
        })
        .eq('id', enrollment.id);
      
      if (unenrollError) throw unenrollError;
      
      // Create note with the reason
      if (params.reason) {
        const notePayload = {
          target_type: 'classes_students',
          target_id: enrollment.id,
          note: params.reason,
          created_by: params.staffId,
        };
        
        const { error: noteError } = await supabase
          .from('notes')
          .insert(notePayload);
        
        if (noteError) throw noteError;
      }
    } catch (error) {
      console.error('Error unenrolling student with reason:', error);
      throw error;
    }
  },
  
  /**
   * Assign a staff member to a class
   */
  assignStaff: async (classId: string, staffId: string): Promise<Tables<'classes_staff'>> => {
    try {
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
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
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { data, error } = await supabase
      .from('classes')
      .select('*')
      .eq('status', status);
    if (error) throw error;
    return (data ?? []) as Tables<'classes'>[];
  },

  /**
   * Get count of active classes (ACTIVE status)
   */
  getActiveClassesCount: async (): Promise<number> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { count, error } = await supabase
      .from('classes')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'ACTIVE');
    
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Get count of current class enrollments (unenrolled_at is null or in the future)
   */
  getCurrentEnrollmentsCount: async (): Promise<number> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { count, error } = await supabase
      .from('classes_students')
      .select('id', { count: 'exact', head: true })
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
    
    if (error) throw error;
    return count ?? 0;
  },
}; 