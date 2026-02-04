/**
 * Topics Files API for tutor-web
 * 
 * IMPORTANT: Tutor-web can only READ through views (vtutor_subject_resources)
 * All writes (create/update topic files) must go through API routes:
 * - POST /api/topics-files
 * - PATCH /api/topics-files/[id]
 */
export const topicsFilesApi = {
  /**
   * Get topic files for a topic
   * Reads from vtutor_subject_resources view (files are nested in the JSON structure)
   * For direct access, tutors can query topics_files through the view context
   */
  getTopicFilesByTopic: async (_topicId: string) => {
    // Note: Topic files are included in vtutor_subject_resources view
    // This is a helper that would need to parse the view structure
    // For now, return empty array - components should use vtutor_subject_resources directly
    return [];
  },
};
