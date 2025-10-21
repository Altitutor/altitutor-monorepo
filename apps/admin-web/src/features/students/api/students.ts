import type { Tables, TablesInsert, TablesUpdate } from '@altitutor/shared';
import { getSupabaseClient } from '@/shared/lib/supabase/client';

/**
 * Students API client for working with student data
 */
export const studentsApi = {
  /**
   * Paginated, server-filtered students list
   */
  list: async (params: {
    search?: string;
    status?: Tables<'students'>['status'] | 'ALL';
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'students'>;
    ascending?: boolean;
  }): Promise<{ students: Tables<'students'>[]; total: number }> => {
    const supabase = getSupabaseClient();
    const {
      search = '',
      status = 'ALL',
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

    // Status filter
    if (status && status !== 'ALL') {
      query = query.eq('status', status as Tables<'students'>['status']);
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
   * Get all students
   */
  getAllStudents: async (): Promise<Tables<'students'>[]> => {
    const { data, error } = await getSupabaseClient().from('students').select('*');
    if (error) throw error;
    return (data ?? []) as Tables<'students'>[];
  },
  
  /**
   * Get a single student with their subjects in an optimized query
   * This solves the N+1 query problem for the student modal
   */
  getStudentWithSubjects: async (studentId: string): Promise<{ student: Tables<'students'> | null; subjects: Tables<'subjects'>[] }> => {
    const supabase = getSupabaseClient();
    
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
    const { data, error } = await getSupabaseClient().from('students').select('*').eq('id', id).single();
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
          ((student as any).email?.toLowerCase().includes(lowerQuery)) ||
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

    const { data: created, error } = await getSupabaseClient()
      .from('students')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return created as Tables<'students'>;
  },
  
  /**
   * Update a student
   */
  updateStudent: async (id: string, data: TablesUpdate<'students'>): Promise<Tables<'students'>> => {
    const { data: updated, error } = await getSupabaseClient()
      .from('students')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Tables<'students'>;
  },
  
  /**
   * Delete a student
   */
  deleteStudent: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    const { error } = await getSupabaseClient().from('students').delete().eq('id', id);
    if (error) throw error;
  },

  
  /**
   * Assign a subject to a student
   */
  assignSubjectToStudent: async (studentId: string, subjectId: string): Promise<Tables<'students_subjects'>> => {
    try {
      // Ensure the user is an admin first
      
      // Check if the assignment already exists
      const { data: existing, error: existingError } = await getSupabaseClient().from('students_subjects').select('id').eq('student_id', studentId).eq('subject_id', subjectId);
      if (existingError) throw existingError;
      if ((existing ?? []).length) return existing[0] as Tables<'students_subjects'>;
      const { data, error } = await getSupabaseClient().from('students_subjects').insert({ student_id: studentId, subject_id: subjectId }).select().single();
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
      const { data, error } = await getSupabaseClient().from('students_subjects').select('id').eq('student_id', studentId).eq('subject_id', subjectId);
      if (error) throw error;
      if ((data ?? []).length) {
        const { error: delError } = await getSupabaseClient().from('students_subjects').delete().eq('student_id', studentId).eq('subject_id', subjectId);
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
    const supabase = getSupabaseClient();
    
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
      
      // Get all student-class enrollments with class and subject details
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          student_id,
          class:classes(
            *,
            subject_details:subjects(*)
          )
        `)
        .eq('status', 'ACTIVE');
      
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
    studentClasses: Record<string, Tables<'classes'>[]>;
  }> => {
    const supabase = getSupabaseClient();
    const studentSubjects: Record<string, Tables<'subjects'>[]> = {};
    const studentClasses: Record<string, Tables<'classes'>[]> = {};

    if (!studentIds.length) {
      return { studentSubjects, studentClasses };
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

    // Classes mapping (active enrollments) for these students
    const { data: csData, error: csError } = await supabase
      .from('classes_students')
      .select('student_id, class:classes(*)')
      .eq('status', 'ACTIVE')
      .in('student_id', studentIds);
    if (csError) throw csError;
    csData?.forEach((row: any) => {
      const sid = row.student_id as string;
      const cls = row.class as Tables<'classes'> | null;
      if (sid && cls) studentClasses[sid].push(cls);
    });

    return { studentSubjects, studentClasses };
  },

  /**
   * Paginated students with detail mappings (subjects/classes) for current page
   */
  getStudentsWithDetailsPage: async (params: {
    search?: string;
    status?: Tables<'students'>['status'] | 'ALL';
    limit?: number;
    offset?: number;
    orderBy?: keyof Tables<'students'>;
    ascending?: boolean;
  }): Promise<{ 
    students: Tables<'students'>[];
    studentSubjects: Record<string, Tables<'subjects'>[]>;
    studentClasses: Record<string, Tables<'classes'>[]>;
    total: number;
  }> => {
    const { students, total } = await studentsApi.list(params);
    const ids = students.map(s => s.id);
    const { studentSubjects, studentClasses } = await studentsApi.getDetailsForStudentIds(ids);
    return { students, studentSubjects, studentClasses, total };
  },
}; 