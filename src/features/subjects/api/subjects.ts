import { subjectRepository } from '@/lib/supabase/db/repositories';
import type { Subject, Topic, Subtopic } from '../types';
import { adminRepository } from '@/lib/supabase/db/admin';
import { useSupabaseClient, getSupabaseClient } from '@/lib/supabase/client';
import { 
  staffSubjectsRepository, 
  studentsSubjectsRepository, 
  staffRepository, 
  studentRepository, 
  classRepository,
  topicRepository,
  subtopicRepository
} from '@/lib/supabase/db/repositories';

/**
 * Subjects API client for working with subject data
 */
export const subjectsApi = {
  /**
   * Get all subjects
   */
  getAllSubjects: async (): Promise<Subject[]> => {
    return subjectRepository.getAll();
  },
  
  /**
   * Get a subject by ID
   */
  getSubject: async (id: string): Promise<Subject | undefined> => {
    return subjectRepository.getById(id);
  },
  
  /**
   * Search subjects by name, curriculum, or year level
   */
  searchSubjects: async (query: string): Promise<Subject[]> => {
    try {
      // Get all subjects first
      const allSubjects = await subjectRepository.getAll();
      
      // Filter subjects based on the search query
      const lowerQuery = query.toLowerCase();
      return allSubjects.filter(subject => {
        return (
          (subject.name?.toLowerCase().includes(lowerQuery)) ||
          (subject.curriculum?.toLowerCase().includes(lowerQuery)) ||
          (subject.yearLevel?.toString().includes(lowerQuery))
        );
      });
    } catch (error) {
      console.error('Error searching subjects:', error);
      throw error;
    }
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
  },

  /**
   * Get staff members assigned to a subject
   */
  getSubjectStaff: async (subjectId: string) => {
    try {
      // Get all staff_subjects entries for this subject
      const staffSubjects = await staffSubjectsRepository.getBy('subject_id', subjectId);
      
      if (!staffSubjects.length) {
        return [];
      }
      
      // Get staff details for each staff_id
      const staffPromises = staffSubjects.map(async (staffSubject) => {
        return staffRepository.getById(staffSubject.staffId);
      });
      
      const staffResults = await Promise.all(staffPromises);
      // Filter out undefined results (in case a staff doesn't exist anymore)
      return staffResults.filter(staff => staff !== undefined);
    } catch (error) {
      console.error('Error getting subject staff:', error);
      throw error;
    }
  },

  /**
   * Get students enrolled in a subject
   */
  getSubjectStudents: async (subjectId: string) => {
    try {
      // Get all students_subjects entries for this subject
      const studentSubjects = await studentsSubjectsRepository.getBy('subject_id', subjectId);
      
      if (!studentSubjects.length) {
        return [];
      }
      
      // Get student details for each student_id
      const studentPromises = studentSubjects.map(async (studentSubject) => {
        return studentRepository.getById(studentSubject.studentId);
      });
      
      const studentResults = await Promise.all(studentPromises);
      // Filter out undefined results (in case a student doesn't exist anymore)
      return studentResults.filter(student => student !== undefined);
    } catch (error) {
      console.error('Error getting subject students:', error);
      throw error;
    }
  },

  /**
   * Get classes for a subject
   */
  getSubjectClasses: async (subjectId: string) => {
    try {
      // Use our repository with the correct field name
      return classRepository.getBy('subject_id', subjectId);
    } catch (error) {
      console.error('Error getting subject classes:', error);
      throw error;
    }
  },

  /**
   * Get topics for a subject
   */
  getSubjectTopics: async (subjectId: string): Promise<Topic[]> => {
    try {
      const topics = await topicRepository.getBy('subject_id', subjectId);
      return topics.sort((a, b) => a.number - b.number);
    } catch (error) {
      console.error('Error getting subject topics:', error);
      throw error;
    }
  },

  /**
   * Get subtopics for a topic
   */
  getTopicSubtopics: async (topicId: string): Promise<Subtopic[]> => {
    try {
      const subtopics = await subtopicRepository.getBy('topic_id', topicId);
      return subtopics.sort((a, b) => a.number - b.number);
    } catch (error) {
      console.error('Error getting topic subtopics:', error);
      throw error;
    }
  },
}; 