import type { Tables, TablesInsert, TablesUpdate, Database, ClassWithExpandedSubject } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Students API client for working with student data
 */
export const studentsApi = {
  /**
   * Paginated, server-filtered students list
   */
  list: async (params: {
    search?: string;
    statuses?: Tables<'students'>['status'][];
    curriculums?: string[];
    yearLevels?: number[];
    subjectIds?: string[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'students'>;
    ascending?: boolean;
  }): Promise<{ students: Tables<'students'>[]; total: number }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const {
      search = '',
      statuses = [],
      curriculums = [],
      yearLevels = [],
      subjectIds = [],
      limit = 20,
      offset = 0,
      orderBy = 'last_name',
      ascending = true,
    } = params || {};

    let query = supabase
      .from('students')
      .select(
        // Narrow projection to columns required by index views
        'id, first_name, last_name, status, curriculum, year_level, school',
        { count: 'exact' }
      );

    // Search across common fields
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(
        `first_name.ilike.${q},last_name.ilike.${q},school.ilike.${q}`
      );
    }

    // Status filter (multiple selection with OR)
    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    }

    // Curriculum filter (multiple selection with OR)
    if (curriculums && curriculums.length > 0) {
      query = query.in('curriculum', curriculums);
    }

    // Year level filter (multiple selection with OR)
    if (yearLevels && yearLevels.length > 0) {
      query = query.in('year_level', yearLevels);
    }

    // If subject filter is provided, we need to join with students_subjects
    // This is more complex and requires a different approach
    let studentIds: string[] | null = null;
    if (subjectIds && subjectIds.length > 0) {
      const { data: studentsSubjectsData, error: ssError } = await supabase
        .from('students_subjects')
        .select('student_id')
        .in('subject_id', subjectIds);
      
      if (ssError) throw ssError;
      
      // Get unique student IDs
      studentIds = Array.from(new Set(studentsSubjectsData?.map(ss => ss.student_id) || []));
      
      // If no students found with these subjects, return empty result
      if (studentIds.length === 0) {
        return { students: [], total: 0 };
      }
      
      query = query.in('id', studentIds);
    }

    // Sorting
    query = query.order(orderBy as string, { ascending });

    // Pagination
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data, count, error } = await query;
    if (error) throw error;
    return { students: (data ?? []) as unknown as Tables<'students'>[], total: count ?? 0 };
  },
  
  /**
   * Minimal fields for table display only
   * Returns: id, first_name, last_name, status, curriculum, year_level, school
   * WITH nested classes: id, name, day_of_week, start_time
   */
  listMinimal: async (params: {
    search?: string;
    statuses?: Tables<'students'>['status'][];
    curriculums?: string[];
    yearLevels?: number[];
    subjectIds?: string[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'students'>;
    ascending?: boolean;
  }): Promise<{ students: (Tables<'students'> & { classes?: Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }> })[]; total: number }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const {
      search = '',
      statuses = [],
      curriculums = [],
      yearLevels = [],
      subjectIds = [],
      limit = 20,
      offset = 0,
      orderBy = 'last_name',
      ascending = true,
    } = params || {};

    // First, get the student IDs matching filters (same logic as list())
    let studentIds: string[] | null = null;
    if (subjectIds && subjectIds.length > 0) {
      const { data: studentsSubjectsData, error: ssError } = await supabase
        .from('students_subjects')
        .select('student_id')
        .in('subject_id', subjectIds);
      
      if (ssError) throw ssError;
      studentIds = Array.from(new Set(studentsSubjectsData?.map(ss => ss.student_id) || []));
      if (studentIds.length === 0) {
        return { students: [], total: 0 };
      }
    }

    // Build base query with minimal fields only
    let query = supabase
      .from('students')
      .select(
        'id, first_name, last_name, status, curriculum, year_level, school',
        { count: 'exact' }
      );

    // Apply filters
    const trimmed = search.trim();
    if (trimmed.length > 0) {
      const q = `%${trimmed}%`;
      query = query.or(`first_name.ilike.${q},last_name.ilike.${q},school.ilike.${q}`);
    }

    if (statuses && statuses.length > 0) {
      query = query.in('status', statuses);
    }
    if (curriculums && curriculums.length > 0) {
      query = query.in('curriculum', curriculums);
    }
    if (yearLevels && yearLevels.length > 0) {
      query = query.in('year_level', yearLevels);
    }
    if (studentIds) {
      query = query.in('id', studentIds);
    }

    query = query.order(orderBy as string, { ascending });
    const from = offset;
    const to = Math.max(offset + limit - 1, offset);
    query = query.range(from, to);

    const { data: studentsData, count, error } = await query;
    if (error) throw error;

    const students = studentsData ?? [];

    // Fetch classes for these students - use same pattern as staff table
    if (students.length > 0) {
      const studentIds = students.map((s: any) => s.id);
      
      // Get all student-class enrollments with class details AND subject information (like staff table does)
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
      const activeEnrollments = (enrollmentsData ?? []).filter((e: any) => 
        !e.unenrolled_at || new Date(e.unenrolled_at) > new Date()
      );
      
      // Build student -> classes map with subject data
      const studentClassesMap: Record<string, Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }>> = {};
      studentIds.forEach(id => {
        studentClassesMap[id] = [];
      });
      
      activeEnrollments.forEach((enrollment: any) => {
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
      
      // Attach classes to students
      const studentsWithClasses = students.map((student: any) => ({
        ...student,
        classes: studentClassesMap[student.id] || [],
      }));
      
      return {
        students: studentsWithClasses as unknown as (Tables<'students'> & { classes?: Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }> })[],
        total: count ?? 0,
      };
    }

    // No students
    return {
      students: students as unknown as (Tables<'students'> & { classes?: Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }> })[],
      total: count ?? 0
    };
  },
  
  /**
   * Get full student details for modal view
   * Returns: student, subjects, classes, parents, upcoming sessions, billing status
   * Single optimized query using Supabase joins
   */
  getStudentDetails: async (studentId: string): Promise<{
    student: Tables<'students'> | null;
    subjects: Tables<'subjects'>[];
    classes: ClassWithExpandedSubject[];
    parents: Tables<'parents'>[];
    upcomingSessions: Tables<'sessions'>[];
    billingStatus: {
      balance: number;
      hasPaymentMethod: boolean;
    } | null;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get student with all related data in optimized queries
      const [studentResult, subjectsResult, classesResult, parentsResult, sessionsResult, billingResult] = await Promise.all([
        // Student record
        supabase
          .from('students')
          .select('*')
          .eq('id', studentId)
          .single(),
        
        // Subjects
        supabase
          .from('students_subjects')
          .select('subject_details:subjects(*)')
          .eq('student_id', studentId),
        
        // Current and future classes with subject details
        supabase
          .from('classes_students')
          .select(`
            class:classes(
              *,
              subject_details:subjects(*)
            )
          `)
          .eq('student_id', studentId)
          .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`),
        
        // Parents
        supabase
          .from('parents_students')
          .select('parent_details:parents(*)')
          .eq('student_id', studentId),
        
        // Upcoming sessions (next 5) - fetch from sessions directly with student filter
        supabase
          .from('sessions_students')
          .select('sessions!inner(*)')
          .eq('student_id', studentId),
        
        // Billing status (check if student has payment method)
        supabase
          .from('students')
          .select('id')
          .eq('id', studentId)
          .single(),
      ]);

      if (studentResult.error && studentResult.error.code !== 'PGRST116') {
        throw studentResult.error;
      }
      if (subjectsResult.error) throw subjectsResult.error;
      if (classesResult.error) throw classesResult.error;
      if (parentsResult.error) throw parentsResult.error;
      if (sessionsResult.error) throw sessionsResult.error;

      const student = studentResult.data as Tables<'students'> | null;
      if (!student) {
        return {
          student: null,
          subjects: [],
          classes: [],
          parents: [],
          upcomingSessions: [],
          billingStatus: null,
        };
      }

      // Transform subjects
      const subjects = (subjectsResult.data ?? [])
        .map((row: any) => row.subject_details)
        .filter(Boolean) as Tables<'subjects'>[];

      // Transform classes
      const classes: ClassWithExpandedSubject[] = (classesResult.data ?? [])
        .map((row: any) => {
          const cls = row.class as (Tables<'classes'> & { subject_details?: Tables<'subjects'> }) | null;
          if (!cls) return null;
          const classWithSubject: ClassWithExpandedSubject = {
            ...cls,
            subject: cls.subject_details,
          };
          delete (classWithSubject as any).subject_details;
          return classWithSubject;
        })
        .filter(Boolean) as ClassWithExpandedSubject[];

      // Transform parents
      const parents = (parentsResult.data ?? [])
        .map((row: any) => row.parent_details)
        .filter(Boolean) as Tables<'parents'>[];

      // Sessions - transform from sessions_students join, filter and sort client-side
      const upcomingSessions = (sessionsResult.data ?? [])
        .map((row: any) => row.sessions)
        .filter((s: any) => s && s.start_at && new Date(s.start_at) >= new Date())
        .sort((a: any, b: any) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())
        .slice(0, 5) as Tables<'sessions'>[];

      // Billing status - simplified for now (can be enhanced later)
      const billingStatus = {
        balance: 0, // TODO: Calculate from billing records
        hasPaymentMethod: false, // TODO: Check payment methods
      };

      return {
        student,
        subjects,
        classes,
        parents,
        upcomingSessions,
        billingStatus,
      };
    } catch (error) {
      console.error('Error getting student details:', error);
      throw error;
    }
  },
  
  /**
   * Get all students
   */
  getAllStudents: async (): Promise<Tables<'students'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('students').select('*');
    if (error) throw error;
    return (data ?? []) as Tables<'students'>[];
  },
  
  /**
   * Get a single student with their subjects in an optimized query
   * This solves the N+1 query problem for the student modal
   */
  getStudentWithSubjects: async (studentId: string): Promise<{ student: Tables<'students'> | null; subjects: Tables<'subjects'>[] }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get student data
      const { data: studentData, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('id', studentId)
        .single();
      
      if (studentError) {
        if (studentError.code === 'PGRST116') {
          return { student: null, subjects: [] };
        }
        throw studentError;
      }
      
      // Get student's subjects in a single query
      const { data: subjectsData, error: subjectsError } = await supabase
        .from('students_subjects')
        .select(`
          subject_details:subjects(*)
        `)
        .eq('student_id', studentId);
      
      if (subjectsError) throw subjectsError;
      
      // Transform student data
      const student = studentData as Tables<'students'>;
      
      // Transform subjects data
      const subjects = subjectsData
        ?.map((row: any) => row.subject_details)
        .filter(Boolean)
        .map((subject: any) => subject as Tables<'subjects'>) || [];
      
      return { student, subjects };
      
    } catch (error) {
      console.error('Error getting student with subjects:', error);
      throw error;
    }
  },
  
  /**
   * Get a student by ID
   */
  getStudent: async (id: string): Promise<Tables<'students'> | null> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('students').select('*').eq('id', id).single();
    if (error && error.code !== 'PGRST116') throw error;
    return (data ?? null) as Tables<'students'> | null;
  },
  
  /**
   * Search students by name, email, or status
   */
  searchStudents: async (query: string): Promise<Tables<'students'>[]> => {
    try {
      // Get all students first
      const allStudents = await studentsApi.getAllStudents();
      
      // Filter students based on the search query
      const lowerQuery = query.toLowerCase();
      return allStudents.filter(student => {
        return (
          (student.first_name?.toLowerCase().includes(lowerQuery)) ||
          (student.last_name?.toLowerCase().includes(lowerQuery)) ||
          (student.email?.toLowerCase().includes(lowerQuery)) ||
          (student.status?.toLowerCase().includes(lowerQuery))
        );
      });
    } catch (error) {
      console.error('Error searching students:', error);
      throw error;
    }
  },
  
  /**
   * Create a new student
   */
  createStudent: async (data: TablesInsert<'students'>): Promise<Tables<'students'>> => {
    // Ensure id exists if the table requires it
    const payload: TablesInsert<'students'> = {
      ...(data as TablesInsert<'students'>),
      id: (data as any)?.id ?? crypto.randomUUID(),
    };

    const { data: created, error } = await (getSupabaseClient() as SupabaseClient<Database>)
      .from('students')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'students'>;
  },
  
  /**
   * Update a student - calls server-side API route for admin operations
   */
  updateStudent: async (id: string, data: TablesUpdate<'students'>): Promise<Tables<'students'>> => {
    try {
      const response = await fetch(`/api/students/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email ?? undefined,
          phone: data.phone,
          status: data.status,
          curriculum: (data as any).curriculum,
          year_level: (data as any).year_level,
          school: (data as any).school,
          availability_monday: (data as any).availability_monday,
          availability_tuesday: (data as any).availability_tuesday,
          availability_wednesday: (data as any).availability_wednesday,
          availability_thursday: (data as any).availability_thursday,
          availability_friday: (data as any).availability_friday,
          availability_saturday_am: (data as any).availability_saturday_am,
          availability_saturday_pm: (data as any).availability_saturday_pm,
          availability_sunday_am: (data as any).availability_sunday_am,
          availability_sunday_pm: (data as any).availability_sunday_pm,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to update student: ${response.statusText}`);
      }

      const result = await response.json();
      return result.data as Tables<'students'>;
    } catch (error) {
      throw new Error(`Unexpected error updating student: ${error instanceof Error ? error.message : error}`);
    }
  },
  
  /**
   * Delete a student - calls server-side API route for admin operations
   */
  deleteStudent: async (id: string): Promise<void> => {
    try {
      const response = await fetch(`/api/students/${id}/delete`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete student: ${response.statusText}`);
      }
    } catch (error) {
      throw new Error(`Unexpected error deleting student: ${error instanceof Error ? error.message : error}`);
    }
  },

  
  /**
   * Assign a subject to a student
   */
  assignSubjectToStudent: async (studentId: string, subjectId: string): Promise<Tables<'students_subjects'>> => {
    try {
      // Ensure the user is an admin first
      
      // Check if the assignment already exists
      const { data: existing, error: existingError } = await (getSupabaseClient() as SupabaseClient<Database>).from('students_subjects').select('id').eq('student_id', studentId).eq('subject_id', subjectId);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return existing[0] as Tables<'students_subjects'>;
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('students_subjects').insert({ student_id: studentId, subject_id: subjectId }).select().single();
      if (error) throw error;
      return data as Tables<'students_subjects'>;
    } catch (error) {
      console.error('Error assigning subject to student:', error);
      throw error;
    }
  },
  
  /**
   * Remove a subject from a student
   */
  removeSubjectFromStudent: async (studentId: string, subjectId: string): Promise<void> => {
    try {
      // Ensure the user is an admin first
      
      // Get all student-subject records for this student and subject
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('students_subjects').select('id').eq('student_id', studentId).eq('subject_id', subjectId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await (getSupabaseClient() as SupabaseClient<Database>).from('students_subjects').delete().eq('student_id', studentId).eq('subject_id', subjectId);
        if (delError) throw delError;
      }
    } catch (error) {
      console.error('Error removing subject from student:', error);
      throw error;
    }
  },

  /**
   * Get all students with their subjects and classes in optimized single queries
   * This solves the N+1 query problem for the students table with class information
   */
  getAllStudentsWithDetails: async (): Promise<{ 
    students: Tables<'students'>[]; 
    studentSubjects: Record<string, Tables<'subjects'>[]>;
    studentClasses: Record<string, Tables<'classes'>[]>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    try {
      // Get all students
      const { data: studentsData, error: studentsError } = await supabase
        .from('students')
        .select('*');
      
      if (studentsError) throw studentsError;
      
      // Get all student-subject relationships
      const { data: studentSubjectsData, error: studentSubjectsError } = await supabase
        .from('students_subjects')
        .select(`
          student_id,
          subject_details:subjects(*)
        `);
      
      if (studentSubjectsError) throw studentSubjectsError;
      
      // Get all student-class enrollments with class and subject details (current and future)
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          student_id,
          enrolled_at,
          enrolled_by,
          unenrolled_at,
          unenrolled_by,
          class:classes(
            *,
            subject_details:subjects(*)
          )
        `)
        .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`);
      
      if (enrollmentsError) throw enrollmentsError;
      
      // Transform and organize the data
      const students = (studentsData ?? []) as Tables<'students'>[];
      const studentSubjects: Record<string, Tables<'subjects'>[]> = {};
      const studentClasses: Record<string, Tables<'classes'>[]> = {};
      
      // Initialize arrays for all students
      students.forEach(student => {
        studentSubjects[student.id] = [];
        studentClasses[student.id] = [];
      });
      
      // Process student subjects
      studentSubjectsData?.forEach((row: any) => {
        if (row.subject_details && row.student_id) {
          const subject = row.subject_details as Tables<'subjects'>;
          if (studentSubjects[row.student_id]) {
            studentSubjects[row.student_id].push(subject);
          }
        }
      });
      
      // Process student classes
      enrollmentsData?.forEach((row: any) => {
        if (row.class && row.student_id) {
          const cls = row.class as Tables<'classes'>;
          if (studentClasses[row.student_id]) {
            studentClasses[row.student_id].push(cls);
          }
        }
      });
      
      return {
        students,
        studentSubjects,
        studentClasses
      };
      
    } catch (error) {
      console.error('Error getting students with details:', error);
      throw error;
    }
  },
  
  /**
   * Get subjects and classes for a given set of student IDs (for paginated UIs)
   */
  getDetailsForStudentIds: async (
    studentIds: string[]
  ): Promise<{ 
    studentSubjects: Record<string, Tables<'subjects'>[]>;
    studentClasses: Record<string, ClassWithExpandedSubject[]>;
    classSubjects: Record<string, Tables<'subjects'>>;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const studentSubjects: Record<string, Tables<'subjects'>[]> = {};
    const studentClasses: Record<string, ClassWithExpandedSubject[]> = {};
    const classSubjects: Record<string, Tables<'subjects'>> = {};

    if (!studentIds.length) {
      return { studentSubjects, studentClasses, classSubjects };
    }

    // Initialize maps
    for (const id of studentIds) {
      studentSubjects[id] = [];
      studentClasses[id] = [];
    }

    // Subjects mapping for these students
    const { data: ssData, error: ssError } = await supabase
      .from('students_subjects')
      .select('student_id, subject_details:subjects(*)')
      .in('student_id', studentIds);
    if (ssError) throw ssError;
    ssData?.forEach((row: any) => {
      const sid = row.student_id as string;
      const subj = row.subject_details as Tables<'subjects'> | null;
      if (sid && subj) studentSubjects[sid].push(subj);
    });

    // Classes mapping (current and future enrollments) with subject information for these students
    const { data: csData, error: csError } = await supabase
      .from('classes_students')
      .select('student_id, enrolled_at, enrolled_by, unenrolled_at, unenrolled_by, class:classes(*, subject_details:subjects(*))')
      .or(`unenrolled_at.is.null,unenrolled_at.gt.${new Date().toISOString()}`)
      .in('student_id', studentIds);
    if (csError) throw csError;
    csData?.forEach((row: any) => {
      const sid = row.student_id as string;
      const classWithSubject = row.class as (Tables<'classes'> & { subject_details?: Tables<'subjects'> }) | null;
      if (sid && classWithSubject) {
        const cls: ClassWithExpandedSubject = {
          ...classWithSubject,
          subject: classWithSubject.subject_details
        };
        delete (cls as any).subject_details;
        delete (cls as any).subject; // Remove the string subject field
        if (classWithSubject.subject_details) {
          (cls as any).subject = classWithSubject.subject_details;
        }
        studentClasses[sid].push(cls);
        
        // Store subject by class ID for easy lookup
        if (classWithSubject.subject_details) {
          classSubjects[classWithSubject.id] = classWithSubject.subject_details;
        }
      }
    });

    return { studentSubjects, studentClasses, classSubjects };
  },

  /**
   * Paginated students with detail mappings (subjects/classes) for current page
   */
  getStudentsWithDetailsPage: async (params: {
    search?: string;
    statuses?: Tables<'students'>['status'][];
    curriculums?: string[];
    yearLevels?: number[];
    subjectIds?: string[];
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'students'>;
    ascending?: boolean;
  }): Promise<{ 
    students: Tables<'students'>[];
    studentSubjects: Record<string, Tables<'subjects'>[]>;
    studentClasses: Record<string, ClassWithExpandedSubject[]>;
    classSubjects: Record<string, Tables<'subjects'>>;
    total: number;
  }> => {
    const { students, total } = await studentsApi.list(params);
    const ids = students.map(s => s.id);
    const { studentSubjects, studentClasses, classSubjects } = await studentsApi.getDetailsForStudentIds(ids);
    return { students, studentSubjects, studentClasses, classSubjects, total };
  },

  /**
   * Get students for multiple parents
   */
  getParentStudents: async (parentIds: string[]): Promise<Record<string, Tables<'students'>[]>> => {
    if (parentIds.length === 0) return {};
    
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    
    const { data, error } = await supabase
      .from('parents_students')
      .select(`
        parent_id,
        students (*)
      `)
      .in('parent_id', parentIds);

    if (error) throw error;

    // Group students by parent_id
    const grouped: Record<string, Tables<'students'>[]> = {};
    data?.forEach((item: any) => {
      if (item.students) {
        if (!grouped[item.parent_id]) {
          grouped[item.parent_id] = [];
        }
        grouped[item.parent_id].push(item.students);
      }
    });

    return grouped;
  },
}; 