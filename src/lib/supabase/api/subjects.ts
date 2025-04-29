import { subjectRepository } from '../db/repositories';
import { Subject } from '../db/types';
import { adminRepository } from '../db/admin';
import { useSupabaseClient, getSupabaseClient } from '../client';

/**
 * Subjects API client for working with subject data
 */
export const subjectsApi = {
  /**
   * Get all subjects
   */
  getAllSubjects: async (): Promise<Subject[]> => {
    try {
      console.log('Getting all subjects from repository');
      const subjects = await subjectRepository.getAll();
      console.log(`Retrieved ${subjects?.length || 0} subjects`);
      return subjects;
    } catch (error) {
      console.error('Error getting subjects:', error);
      throw error;
    }
  },
  
  /**
   * Get a subject by ID
   */
  getSubject: async (id: string): Promise<Subject | undefined> => {
    return subjectRepository.getById(id);
  },
  
  /**
   * Create a new subject
   */
  createSubject: async (data: Partial<Subject>): Promise<Subject> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subjectRepository.create(data);
  },
  
  /**
   * Update a subject
   */
  updateSubject: async (id: string, data: Partial<Subject>): Promise<Subject> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subjectRepository.update(id, data);
  },
  
  /**
   * Delete a subject
   */
  deleteSubject: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subjectRepository.delete(id);
  },

  /**
   * Direct query to get all subjects (bypassing repository)
   * This is a fallback in case the repository approach fails
   */
  directGetAllSubjects: async (): Promise<Subject[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('subjects')
      .select('*');
    
    if (error) {
      console.error('Direct query error:', error);
      throw error;
    }
    
    return data as Subject[];
  }
}; 