import { studentRepository } from '../db/repositories';
import { Student } from '../db/types';
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
   * Create a new student
   */
  createStudent: async (data: Partial<Student>): Promise<Student> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return studentRepository.create(data);
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
   * Add a test student for development
   */
  addTestStudent: async (): Promise<Student> => {
    return adminRepository.addTestStudent();
  },
}; 