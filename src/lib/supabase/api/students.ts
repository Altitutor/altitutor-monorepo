import { studentRepository, studentsSubjectsRepository, subjectRepository } from '../db/repositories';
import { Student, StudentStatus, Subject, StudentsSubjects } from '../db/types';
import { adminRepository } from '../db/admin';

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
}; 