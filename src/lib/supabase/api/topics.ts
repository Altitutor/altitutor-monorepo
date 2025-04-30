import { topicRepository, subtopicRepository, subjectRepository } from '../db/repositories';
import { Topic, Subtopic } from '../db/types';
import { adminRepository } from '../db/admin';
import { getSupabaseClient } from '../client';

/**
 * Topics API client for working with topic and subtopic data
 */
export const topicsApi = {
  /**
   * Get all topics
   */
  getAllTopics: async (): Promise<Topic[]> => {
    try {
      console.log('Getting all topics from repository');
      const topics = await topicRepository.getAll();
      console.log(`Retrieved ${topics?.length || 0} topics`);
      return topics;
    } catch (error) {
      console.error('Error getting topics:', error);
      throw error;
    }
  },
  
  /**
   * Get a topic by ID
   */
  getTopic: async (id: string): Promise<Topic | undefined> => {
    return topicRepository.getById(id);
  },
  
  /**
   * Create a new topic
   */
  createTopic: async (data: Partial<Topic>): Promise<Topic> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return topicRepository.create(data);
  },
  
  /**
   * Update a topic
   */
  updateTopic: async (id: string, data: Partial<Topic>): Promise<Topic> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return topicRepository.update(id, data);
  },
  
  /**
   * Delete a topic
   */
  deleteTopic: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return topicRepository.delete(id);
  },

  /**
   * Direct query to get all topics (bypassing repository)
   * This is a fallback in case the repository approach fails
   */
  directGetAllTopics: async (): Promise<Topic[]> => {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('topics')
      .select('*');
    
    if (error) {
      console.error('Direct query error:', error);
      throw error;
    }
    
    return data as Topic[];
  },

  /**
   * Get all topics for a specific subject
   */
  getTopicsBySubject: async (subjectId: string): Promise<Topic[]> => {
    try {
      const topics = await topicRepository.getBy('subject_id', subjectId);
      return topics.sort((a, b) => a.number - b.number);
    } catch (error) {
      console.error('Error getting topics by subject:', error);
      throw error;
    }
  },

  /**
   * Get all subtopics for a topic
   */
  getSubtopicsByTopic: async (topicId: string): Promise<Subtopic[]> => {
    try {
      const subtopics = await subtopicRepository.getBy('topic_id', topicId);
      return subtopics.sort((a, b) => a.number - b.number);
    } catch (error) {
      console.error('Error getting subtopics by topic:', error);
      throw error;
    }
  },

  /**
   * Get a subtopic by ID
   */
  getSubtopic: async (id: string): Promise<Subtopic | undefined> => {
    return subtopicRepository.getById(id);
  },

  /**
   * Create a new subtopic
   */
  createSubtopic: async (data: Partial<Subtopic>): Promise<Subtopic> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subtopicRepository.create(data);
  },

  /**
   * Update a subtopic
   */
  updateSubtopic: async (id: string, data: Partial<Subtopic>): Promise<Subtopic> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subtopicRepository.update(id, data);
  },

  /**
   * Delete a subtopic
   */
  deleteSubtopic: async (id: string): Promise<void> => {
    // Ensure the user is an admin first
    await adminRepository.ensureAdminUser();
    return subtopicRepository.delete(id);
  },

  /**
   * Get topics with their related subject information
   */
  getTopicsWithSubjects: async (): Promise<Topic[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('topics')
        .select(`
          *,
          subjects:subject_id (
            id,
            name,
            curriculum,
            discipline,
            level,
            year_level
          )
        `);
      
      if (error) {
        console.error('Error fetching topics with subjects:', error);
        throw error;
      }
      
      // Convert from DB format to model format
      const topics = data.map(topic => ({
        ...topic,
        subjectId: topic.subject_id,
        subject: topic.subjects
      }));
      
      return topics as Topic[];
    } catch (error) {
      console.error('Error in getTopicsWithSubjects:', error);
      throw error;
    }
  },

  /**
   * Get all subtopics with their related topic information
   */
  getAllSubtopicsWithTopics: async (): Promise<Subtopic[]> => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('subtopics')
        .select(`
          *,
          topics:topic_id (
            id,
            name,
            subject_id,
            number,
            area
          )
        `);
      
      if (error) {
        console.error('Error fetching subtopics with topics:', error);
        throw error;
      }
      
      // Convert from DB format to model format
      const subtopics = data.map(subtopic => ({
        ...subtopic,
        topicId: subtopic.topic_id,
        topic: subtopic.topics ? {
          ...subtopic.topics,
          subjectId: subtopic.topics.subject_id
        } : undefined
      }));
      
      return subtopics as Subtopic[];
    } catch (error) {
      console.error('Error in getAllSubtopicsWithTopics:', error);
      throw error;
    }
  }
}; 