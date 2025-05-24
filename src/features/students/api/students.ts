import { studentRepository, studentsSubjectsRepository, subjectRepository } from '@/lib/supabase/db/repositories';
import type { Student, StudentsSubjects } from '../types';
import { StudentStatus } from '@/lib/supabase/db/types';
import type { Subject, Class } from '@/lib/supabase/db/types';
import { adminRepository } from '@/lib/supabase/db/admin';
import { getSupabaseClient } from '@/lib/supabase/client';
import { transformToCamelCase } from '@/lib/supabase/db/utils';

/**
 * Students API client for working with student data
 */
export const studentsApi = {
  /**
   * Get all students
   */
  getAllStudents: async (): Promise<Student[]> => {
    return studentRepository.getAll();
  },
  
  /**
   * Get all students with their subjects in an optimized single query
   * This solves the N+1 query problem for the students table
   */
  getAllStudentsWithSubjects: async (): Promise<{ students: Student[]; studentSubjects: Record<string, Subject[]> }> => {
    const supabase = getSupabaseClient();
    
    try {
      // Single query to get all data with joins
      const { data, error } = await supabase
        .from('students')
        .select(`
          *,
          students_subjects!inner(
            subject:subjects(*)
          )
        `);
      
      if (error) throw error;
      
      // Transform the data structure
      const studentsMap = new Map<string, Student>();
      const studentSubjectsMap: Record<string, Subject[]> = {};
      
      // Process the joined data
      data?.forEach((row: any) => {
        // Transform student data to camelCase using repository function
        const student = transformToCamelCase(row) as Student;
        
        studentsMap.set(student.id, student);
        
        // Initialize subjects array for this student if not exists
        if (!studentSubjectsMap[student.id]) {
          studentSubjectsMap[student.id] = [];
        }
        
        // Process subjects for this student
        if (row.students_subjects && Array.isArray(row.students_subjects)) {
          row.students_subjects.forEach((studentSubject: any) => {
            if (studentSubject.subject) {
              const subject = transformToCamelCase(studentSubject.subject) as Subject;
              
              // Add subject if not already in the array (avoid duplicates)
              if (!studentSubjectsMap[student.id].some(s => s.id === subject.id)) {
                studentSubjectsMap[student.id].push(subject);
              }
            }
          });
        }
      });
      
      // Also get students with no subjects
      const { data: allStudents, error: allStudentsError } = await supabase
        .from('students')
        .select('*');
      
      if (allStudentsError) throw allStudentsError;
      
      // Add students with no subjects to the result
      allStudents?.forEach((row: any) => {
        if (!studentsMap.has(row.id)) {
          const student = transformToCamelCase(row) as Student;
          
          studentsMap.set(student.id, student);
          studentSubjectsMap[student.id] = [];
        }
      });
      
      return {
        students: Array.from(studentsMap.values()),
        studentSubjects: studentSubjectsMap
      };
      
    } catch (error) {
      console.error('Error getting students with subjects:', error);
      throw error;
    }
  },
  
  /**
   * Get a single student with their subjects in an optimized query
   * This solves the N+1 query problem for the student modal
   */
  getStudentWithSubjects: async (studentId: string): Promise<{ student: Student | null; subjects: Subject[] }> => {
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
          subject:subjects(*)
        `)
        .eq('student_id', studentId);
      
      if (subjectsError) throw subjectsError;
      
      // Transform student data
      const student = transformToCamelCase(studentData) as Student;
      
      // Transform subjects data
      const subjects = subjectsData
        ?.map((row: any) => row.subject)
        .filter(Boolean)
        .map((subject: any) => transformToCamelCase(subject) as Subject) || [];
      
      return { student, subjects };
      
    } catch (error) {
      console.error('Error getting student with subjects:', error);
      throw error;
    }
  },
  
  /**
   * Get a student by ID
   */
  getStudent: async (id: string): Promise<Student | undefined> => {
    return studentRepository.getById(id);
  },
  
  /**
   * Search students by name, email, or status
   */
  searchStudents: async (query: string): Promise<Student[]> => {
    try {
      // Get all students first
      const allStudents = await studentRepository.getAll();
      
      // Filter students based on the search query
      const lowerQuery = query.toLowerCase();
      return allStudents.filter(student => {
        return (
          (student.firstName?.toLowerCase().includes(lowerQuery)) ||
          (student.lastName?.toLowerCase().includes(lowerQuery)) ||
          (student.studentEmail?.toLowerCase().includes(lowerQuery)) ||
          (student.parentEmail?.toLowerCase().includes(lowerQuery)) ||
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
  createStudent: async (data: Partial<Student>): Promise<Student> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    
    // Set default status if not provided
    const studentData: Partial<Student> = {
      ...data,
      status: data.status || StudentStatus.TRIAL,
    };
    
    return studentRepository.create(studentData);
  },
  
  /**
   * Update a student
   */
  updateStudent: async (id: string, data: Partial<Student>): Promise<Student> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return studentRepository.update(id, data);
  },
  
  /**
   * Delete a student
   */
  deleteStudent: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return studentRepository.delete(id);
  },

  /**
   * Get all subjects assigned to a student
   */
  getStudentSubjects: async (studentId: string): Promise<Subject[]> => {
    try {
      // Get all students_subjects entries for this student
      const studentSubjects = await studentsSubjectsRepository.getBy('student_id', studentId);
      
      if (!studentSubjects.length) {
        return [];
      }
      
      // Get subject details for each subject_id
      const subjectPromises = studentSubjects.map(async (studentSubject) => {
        return subjectRepository.getById(studentSubject.subjectId);
      });
      
      const subjectResults = await Promise.all(subjectPromises);
      // Filter out undefined results (in case a subject doesn't exist anymore)
      return subjectResults.filter(subject => subject !== undefined) as Subject[];
    } catch (error) {
      console.error('Error getting student subjects:', error);
      throw error;
    }
  },
  
  /**
   * Assign a subject to a student
   */
  assignSubjectToStudent: async (studentId: string, subjectId: string): Promise<StudentsSubjects> => {
    try {
      // Ensure the user is an admin first
      await adminRepository.ensureAdminUser();
      
      // Check if the assignment already exists
      const existing = await studentsSubjectsRepository.getBy('student_id', studentId);
      const existingSubject = existing.find(record => record.subjectId === subjectId);
      
      if (existingSubject) {
        return existingSubject; // Already assigned, return existing record
      }
      
      // Create the student-subject assignment
      const studentSubject: Partial<StudentsSubjects> = {
        studentId,
        subjectId,
      };
      
      return studentsSubjectsRepository.create(studentSubject);
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
      await adminRepository.ensureAdminUser();
      
      // Get all student-subject records for this student and subject
      const studentSubjects = await studentsSubjectsRepository.getBy('student_id', studentId);
      
      // Find the specific record for this subject
      const recordToDelete = studentSubjects.find(record => record.subjectId === subjectId);
      
      if (recordToDelete) {
        await studentsSubjectsRepository.delete(recordToDelete.id);
      }
    } catch (error) {
      console.error('Error removing subject from student:', error);
      throw error;
    }
  },

  /**
   * Get students by status
   */
  getStudentsByStatus: async (status: StudentStatus): Promise<Student[]> => {
    try {
      return studentRepository.findByModelField('status', status);
    } catch (error) {
      console.error('Error getting students by status:', error);
      throw error;
    }
  },

  /**
   * Get all students with their subjects and classes in optimized single queries
   * This solves the N+1 query problem for the students table with class information
   */
  getAllStudentsWithDetails: async (): Promise<{ 
    students: Student[]; 
    studentSubjects: Record<string, Subject[]>;
    studentClasses: Record<string, Class[]>;
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
          subject:subjects(*)
        `);
      
      if (studentSubjectsError) throw studentSubjectsError;
      
      // Get all student-class enrollments with class and subject details
      const { data: enrollmentsData, error: enrollmentsError } = await supabase
        .from('classes_students')
        .select(`
          student_id,
          class:classes(
            *,
            subject:subjects(*)
          )
        `)
        .eq('status', 'ACTIVE');
      
      if (enrollmentsError) throw enrollmentsError;
      
      // Transform and organize the data
      const students = studentsData?.map((row: any) => transformToCamelCase(row) as Student) || [];
      const studentSubjects: Record<string, Subject[]> = {};
      const studentClasses: Record<string, Class[]> = {};
      
      // Initialize arrays for all students
      students.forEach(student => {
        studentSubjects[student.id] = [];
        studentClasses[student.id] = [];
      });
      
      // Process student subjects
      studentSubjectsData?.forEach((row: any) => {
        if (row.subject && row.student_id) {
          const subject = transformToCamelCase(row.subject) as Subject;
          if (studentSubjects[row.student_id]) {
            studentSubjects[row.student_id].push(subject);
          }
        }
      });
      
      // Process student classes
      enrollmentsData?.forEach((row: any) => {
        if (row.class && row.student_id) {
          const cls = transformToCamelCase(row.class) as Class;
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
}; 