import type { Tables, TablesInsert, TablesUpdate, Database, ClassWithExpandedSubject } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { formatClassShortName, formatClassName } from '@/shared/utils';

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

    const trimmed = search.trim();
    
    // Always use RPC function (supports both search and "get all" when search is empty)
    const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
      p_search: trimmed.length > 0 ? trimmed : undefined,
      p_statuses: statuses.length > 0 ? statuses : ['ACTIVE', 'TRIAL'],
      p_include_relationships: true,
      p_limit: limit,
      p_offset: offset,
      p_order_by: orderBy as string,
      p_ascending: ascending,
    });

    if (rpcError) throw rpcError;
    if (!rpcResult) return { students: [], total: 0 };

    const rpcData = rpcResult as { students: any[]; total: number };
    let students = (rpcData.students || []) as any[];

    // Apply additional filters that RPC doesn't support (curriculums, yearLevels, subjectIds)
    if (curriculums.length > 0) {
      students = students.filter((s) => s.curriculum && curriculums.includes(s.curriculum));
    }
    if (yearLevels.length > 0) {
      students = students.filter((s) => s.year_level && yearLevels.includes(s.year_level));
    }
    if (subjectIds.length > 0) {
      // Filter by subject IDs - check if student has any of the requested subjects in their classes
      students = students.filter((s) => {
        const studentClasses = s.classes || [];
        return studentClasses.some((cls: any) => cls.subject && subjectIds.includes(cls.subject.id));
      });
    }

    // Transform RPC response to match expected format
    const transformedStudents = students.map((s: any) => ({
      id: s.id,
      first_name: s.first_name,
      last_name: s.last_name,
      status: s.status,
      curriculum: s.curriculum,
      year_level: s.year_level,
      school: s.school,
      classes: (s.classes || []).map((cls: any) => ({
        id: cls.id,
        day_of_week: cls.day_of_week,
        start_time: cls.start_time,
        level: cls.level,
        subject: cls.subject || null,
      })),
    }));

    // Use RPC total for pagination (client-side filters reduce visible items but don't affect total count for pagination)
    // Note: If client-side filters are applied, the actual filtered total may be lower, but we use RPC total
    // to maintain correct pagination. The UI will show fewer items on some pages due to filtering.
    const total = rpcData.total;

    return {
      students: transformedStudents as unknown as (Tables<'students'> & { classes?: Array<{ id: string; day_of_week: number; start_time: string; level: string | null; subject?: Tables<'subjects'> | null }> })[],
      total,
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
   * Uses server-side RPC search to avoid pagination limits
   */
  searchStudents: async (query: string): Promise<Tables<'students'>[]> => {
    try {
      const trimmed = query.trim();
      if (!trimmed) return [];
      
      const supabase = (getSupabaseClient() as SupabaseClient<Database>);
      
      // Use server-side search function to avoid pagination limits
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: trimmed,
        p_statuses: undefined, // Search all statuses
        p_include_relationships: false,
        p_limit: 1000, // Reasonable limit for search results
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });

      if (rpcError) throw rpcError;
      if (!rpcResult) return [];

      const rpcData = rpcResult as { students: any[]; total: number };
      // Transform RPC response to match Tables<'students'> format
      return (rpcData.students || []).map((s: any) => ({
        id: s.id,
        first_name: s.first_name,
        last_name: s.last_name,
        status: s.status,
        curriculum: s.curriculum || null,
        year_level: s.year_level || null,
        school: s.school || null,
        email: s.email || null,
        phone: s.phone || null,
        created_at: s.created_at || null,
        updated_at: s.updated_at || null,
      })) as Tables<'students'>[];
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
   * Get all students with their subjects and classes using RPC function
   * This solves the N+1 query problem for the students table with class information
   * Note: This function may not return all students if there are more than the limit.
   * Consider using paginated queries for large datasets.
   */
  getAllStudentsWithDetails: async (params?: { limit?: number; statuses?: Tables<'students'>['status'][] }): Promise<{ 
    students: Tables<'students'>[]; 
    studentSubjects: Record<string, Tables<'subjects'>[]>;
    studentClasses: Record<string, Tables<'classes'>[]>;
    total: number;
  }> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { limit = 5000, statuses } = params || {}; // Default to 5000, configurable
    
    try {
      // Use RPC function to get students with pagination support
      const { data: rpcResult, error: rpcError } = await supabase.rpc('search_students_admin', {
        p_search: undefined,
        p_statuses: statuses, // Get specified statuses or all if undefined
        p_include_relationships: true,
        p_limit: limit,
        p_offset: 0,
        p_order_by: 'last_name',
        p_ascending: true,
      });
      
      if (rpcError) throw rpcError;
      if (!rpcResult) return { students: [], studentSubjects: {}, studentClasses: {}, total: 0 };
      
      const rpcData = rpcResult as { students: any[]; total: number };
      const rpcStudents = (rpcData.students || []) as any[];
      
      // Transform RPC response to match expected format
      const students: Tables<'students'>[] = [];
      const studentSubjects: Record<string, Tables<'subjects'>[]> = {};
      const studentClasses: Record<string, Tables<'classes'>[]> = {};
      
      // Initialize arrays for all students
      rpcStudents.forEach((s: any) => {
        students.push({
          id: s.id,
          first_name: s.first_name,
          last_name: s.last_name,
          status: s.status,
          curriculum: s.curriculum,
          year_level: s.year_level,
          school: s.school,
          // Include all other student fields that might be needed
          email: s.email || null,
          phone: s.phone || null,
          created_at: s.created_at || null,
          updated_at: s.updated_at || null,
        } as Tables<'students'>);
        
        studentSubjects[s.id] = [];
        studentClasses[s.id] = [];
        
        // Extract classes from RPC response
        if (s.classes && Array.isArray(s.classes)) {
          s.classes.forEach((cls: any) => {
            // Extract class data (without subject nested structure)
            const classData: Tables<'classes'> = {
              id: cls.id,
              day_of_week: cls.day_of_week,
              start_time: cls.start_time,
              end_time: cls.end_time,
              status: cls.status || 'ACTIVE',
              room: cls.room || null,
              subject_id: cls.subject_id || cls.subject?.id || null,
              level: cls.level || null,
              created_at: cls.created_at || null,
              updated_at: cls.updated_at || null,
            } as Tables<'classes'>;
            
            studentClasses[s.id].push(classData);
          });
        }
      });
      
      // Get student subjects separately (RPC doesn't include subjects directly, only via classes)
      // We need to fetch students_subjects to get direct subject assignments
      if (students.length > 0) {
        const studentIds = students.map(s => s.id);
        const { data: studentSubjectsData, error: studentSubjectsError } = await supabase
          .from('students_subjects')
          .select(`
            student_id,
            subject_details:subjects(*)
          `)
          .in('student_id', studentIds);
        
        if (studentSubjectsError) throw studentSubjectsError;
        
        studentSubjectsData?.forEach((row: any) => {
          if (row.subject_details && row.student_id) {
            const subject = row.subject_details as Tables<'subjects'>;
            if (studentSubjects[row.student_id]) {
              studentSubjects[row.student_id].push(subject);
            }
          }
        });
      }
      
      return {
        students,
        studentSubjects,
        studentClasses,
        total: rpcData.total || students.length,
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

  /**
   * Get count of active students (ACTIVE or TRIAL status)
   */
  getActiveStudentsCount: async (): Promise<number> => {
    const supabase = (getSupabaseClient() as SupabaseClient<Database>);
    const { count, error } = await supabase
      .from('students')
      .select('id', { count: 'exact', head: true })
      .in('status', ['ACTIVE', 'TRIAL']);
    
    if (error) throw error;
    return count ?? 0;
  },

  /**
   * Get all parents
   */
  getAllParents: async (): Promise<Tables<'parents'>[]> => {
    const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>).from('parents').select('*');
    if (error) throw error;
    return (data ?? []) as Tables<'parents'>[];
  },

  /**
   * Assign a student to a parent
   */
  assignStudentToParent: async (parentId: string, studentId: string): Promise<Tables<'parents_students'>> => {
    try {
      // Check if the assignment already exists
      const { data: existing, error: existingError } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('parents_students')
        .select('id')
        .eq('parent_id', parentId)
        .eq('student_id', studentId);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return existing[0] as Tables<'parents_students'>;
      
      const { data, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('parents_students')
        .insert({ parent_id: parentId, student_id: studentId })
        .select()
        .single();
      if (error) throw error;
      return data as Tables<'parents_students'>;
    } catch (error) {
      console.error('Error assigning student to parent:', error);
      throw error;
    }
  },

  /**
   * Remove a student from a parent
   */
  removeStudentFromParent: async (parentId: string, studentId: string): Promise<void> => {
    try {
      const { error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('parents_students')
        .delete()
        .eq('parent_id', parentId)
        .eq('student_id', studentId);
      if (error) throw error;
    } catch (error) {
      console.error('Error removing student from parent:', error);
      throw error;
    }
  },

  /**
   * Assign a parent to a student (alias for assignStudentToParent)
   */
  assignParentToStudent: async (studentId: string, parentId: string): Promise<Tables<'parents_students'>> => {
    return studentsApi.assignStudentToParent(parentId, studentId);
  },

  /**
   * Remove a parent from a student (alias for removeStudentFromParent)
   */
  removeParentFromStudent: async (studentId: string, parentId: string): Promise<void> => {
    return studentsApi.removeStudentFromParent(parentId, studentId);
  },

  /**
   * Update a parent
   */
  updateParent: async (id: string, data: TablesUpdate<'parents'>): Promise<Tables<'parents'>> => {
    try {
      const { data: updated, error } = await (getSupabaseClient() as SupabaseClient<Database>)
        .from('parents')
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return updated as Tables<'parents'>;
    } catch (error) {
      console.error('Error updating parent:', error);
      throw new Error(`Failed to update parent: ${error instanceof Error ? error.message : error}`);
    }
  },
}; 